/**
 * Recipe Provenance inference.
 *
 * The AI Runtime is the single mocked AI seam. What matters here is what the
 * feature hands the runtime — its prompt identity, its composed input, and a
 * schema built from the administrator's vocabulary — and what survives coming
 * back: the note's language follows the recipe's, and an unusable response
 * fails without anything being written. The cuisines repository stays mocked
 * as a genuine data dependency: resolving names against the vocabulary is the
 * feature's own domain logic.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCuisines, listCuisines } from "@norish/db/repositories/cuisines";
import {
  AIDisabledError,
  AIProviderError,
  AIResponseError,
} from "@norish/shared-server/ai/runtime/errors";
import {
  getCuisineStrategy,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  decide: vi.fn(),
  verifyClaims: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
  decide: mocked.decide,
}));

vi.mock("@norish/shared-server/ai/enrichment/verification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/ai/enrichment/verification")>()),
  verifyClaims: mocked.verifyClaims,
}));

vi.mock("@norish/db/repositories/cuisines", () => ({
  listCuisines: vi.fn(),
  createCuisines: vi.fn(),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getCuisineStrategy: vi.fn(),
  isDecisionUseEnabled: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { inferRecipeProvenance, countryChoiceCriteria, COUNTRY_THRESHOLD, CUISINE_THRESHOLD } =
  await import("@norish/shared-server/ai/enrichment/provenance-inferrer");

const ITALIAN_RECIPE = {
  title: "Cacio e Pepe",
  description: "Un primo piatto romano",
  ingredients: ["spaghetti", "pecorino romano", "pepe nero"],
};

const DUTCH_RECIPE = {
  title: "Stamppot boerenkool",
  description: "Een Hollandse winterklassieker",
  ingredients: ["aardappelen", "boerenkool", "rookworst"],
};

const VOCABULARY = [
  { id: "id-italian", name: "Italian", createdAt: new Date(), version: 1 },
  { id: "id-japanese", name: "Japanese", createdAt: new Date(), version: 1 },
  { id: "id-dutch", name: "Dutch", createdAt: new Date(), version: 1 },
];

function respondWith(output: unknown) {
  mocked.generateStructured.mockResolvedValue(output);
}

interface CapturedRequest {
  prompt: string;
  fill: Record<string, string>;
  sections: string[];
  schema: {
    shape: Record<string, { description?: string }>;
  };
}

/** The one request the feature made of the runtime. */
function sentRequest(): CapturedRequest {
  expect(mocked.generateStructured).toHaveBeenCalledTimes(1);

  return mocked.generateStructured.mock.calls[0]?.[0] as CapturedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCuisineStrategy).mockResolvedValue("existing");
  vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
  vi.mocked(listCuisines).mockResolvedValue(VOCABULARY);
  vi.mocked(createCuisines).mockResolvedValue([]);
  // Validation keeps everything unless a test says otherwise.
  mocked.verifyClaims.mockImplementation(({ claims }: { claims: { id: string }[] }) =>
    Promise.resolve({ kept: claims, dropped: [], mode: "off" })
  );
});

describe("inferRecipeProvenance", () => {
  it("is inert rather than broken when AI is globally disabled", async () => {
    // The runtime refuses; the feature writes nothing and lets the refusal out.
    mocked.generateStructured.mockRejectedValue(new AIDisabledError());

    await expect(inferRecipeProvenance(ITALIAN_RECIPE)).rejects.toBeInstanceOf(AIDisabledError);
    expect(createCuisines).not.toHaveBeenCalled();
  });

  it("refuses a recipe with no ingredients", async () => {
    await expect(inferRecipeProvenance({ ...ITALIAN_RECIPE, ingredients: [] })).rejects.toThrow(
      "No ingredients"
    );
    expect(mocked.generateStructured).not.toHaveBeenCalled();
  });

  it("runs under the administrator-editable Recipe Provenance prompt", async () => {
    respondWith({
      originCountry: "IT",
      originRegion: "Roma",
      cuisines: [],
      provenanceNote: "Un classico romano.",
    });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    const request = sentRequest();

    expect(request.prompt).toBe("recipe-provenance");
    expect(request.fill).toMatchObject({ recipeName: "Cacio e Pepe" });
  });

  it("sends only the stored recipe, never how it entered Norish", async () => {
    respondWith({
      originCountry: "IT",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Un classico.",
    });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    const composed = Object.values(sentRequest().fill).join("\n");

    expect(composed).toContain("Cacio e Pepe");
    expect(composed).toContain("pecorino romano");
    // Nothing about parsing, importing, or the source URL reaches the model.
    expect(composed).not.toMatch(/import|parser|url|http/i);
  });

  it.each([
    [ITALIAN_RECIPE, "Questa ricetta è un classico della cucina romana."],
    [DUTCH_RECIPE, "Dit gerecht is een Hollandse winterklassieker."],
  ])("returns the note in the recipe's own language", async (recipe, note) => {
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: note });

    const claim = await inferRecipeProvenance(recipe);

    expect(claim.provenanceNote).toBe(note);
  });

  it("carries the country's written name beside the code", async () => {
    respondWith({
      originCountry: "TR",
      originCountryName: "Turkije",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Dit gerecht komt uit de Turkse keuken.",
    });

    const claim = await inferRecipeProvenance(DUTCH_RECIPE);

    expect(claim.originCountry).toBe("TR");
    expect(claim.originCountryName).toBe("Turkije");
  });

  it("drops a written name that arrives without a country code", async () => {
    // The name is the code's companion: a loose name would render a title
    // with no flag and nothing for the picker to agree with.
    respondWith({
      originCountry: null,
      originCountryName: "Italia",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Nota.",
    });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(claim.originCountryName).toBe(null);
  });

  it("degrades a blank written name to null so the endonym fallback applies", async () => {
    respondWith({
      originCountry: "IT",
      originCountryName: "   ",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Nota.",
    });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(claim.originCountry).toBe("IT");
    expect(claim.originCountryName).toBe(null);
  });

  it("asks for the single strongest claim rather than bailing out on rivals", async () => {
    respondWith({
      originCountry: "IT",
      originCountryName: "Italia",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Nota.",
    });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    const schema = sentRequest().schema;

    expect(schema.shape.originCountry!.description).toMatch(/strongest claim/i);
    expect(schema.shape.originCountry!.description).toMatch(/null only when/i);
    expect(schema.shape.originCountryName!.description).toMatch(
      /language the recipe itself is written in/i
    );
  });

  it("fails without writing when the runtime rejects the response", async () => {
    mocked.generateStructured.mockRejectedValue(
      new AIResponseError("The model's response did not match the expected shape.")
    );

    await expect(inferRecipeProvenance(ITALIAN_RECIPE)).rejects.toBeInstanceOf(AIResponseError);
    expect(createCuisines).not.toHaveBeenCalled();
  });

  it("fails without writing when the response carries no usable note", async () => {
    // A blank note is a domain failure the schema does not enforce.
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "   " });

    await expect(inferRecipeProvenance(ITALIAN_RECIPE)).rejects.toBeInstanceOf(AIResponseError);
    expect(createCuisines).not.toHaveBeenCalled();
  });

  it("lets a retryable provider failure out for the queue to retry", async () => {
    mocked.generateStructured.mockRejectedValue(
      new AIProviderError("provider timed out", { retryable: true })
    );

    const error = await inferRecipeProvenance(ITALIAN_RECIPE).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).retryable).toBe(true);
  });
});

describe("supplied slots", () => {
  const RESPONSE = {
    originCountry: "IT",
    originCountryName: "Italia",
    originRegion: "Roma",
    cuisines: [],
    provenanceNote: "Un classico romano.",
  };

  it("appends the supplied slots as a section the model must not contradict", async () => {
    // A section, never a placeholder (ADR-0016): an administrator's customised
    // prompt predates gap-filling and must keep receiving this input.
    respondWith(RESPONSE);

    await inferRecipeProvenance({
      ...ITALIAN_RECIPE,
      supplied: {
        originCountry: "it",
        originRegion: null,
        provenanceNote: "My grandmother's, from Rome.",
        cuisineNames: ["Italian", "Mediterranean"],
      },
    });

    const section = sentRequest().sections.join("\n");

    expect(section).toContain("- originCountry: IT");
    expect(section).toContain("- provenanceNote: My grandmother's, from Rome.");
    expect(section).toContain("- cuisines: Italian, Mediterranean");
    expect(section).not.toContain("originRegion");
    expect(section).toMatch(/do not contradict/i);
    expect(section).toMatch(/unchanged/i);
  });

  it("appends no section when nothing is supplied", async () => {
    respondWith(RESPONSE);

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(sentRequest().sections).toEqual([]);
  });

  it("appends no section when the supplied slots are blank noise", async () => {
    respondWith(RESPONSE);

    await inferRecipeProvenance({
      ...ITALIAN_RECIPE,
      supplied: {
        originCountry: "Italy",
        originRegion: "  ",
        provenanceNote: "",
        cuisineNames: ["  "],
      },
    });

    expect(sentRequest().sections).toEqual([]);
  });
});

describe("Cuisines", () => {
  function describeCuisineField(): string {
    return sentRequest().schema.shape.cuisines!.description ?? "";
  }

  it("builds the request schema from the vocabulary as it stands right now", async () => {
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "Note." });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    // Not from a compile-time enum: whatever the administrator has right now.
    expect(listCuisines).toHaveBeenCalled();
    expect(describeCuisineField()).toContain("Italian, Japanese, Dutch");
  });

  it("offers the vocabulary to the prompt and pins the names to its language", async () => {
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "Note." });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(sentRequest().fill).toMatchObject({ cuisines: "Italian, Japanese, Dutch" });
    expect(describeCuisineField()).toMatch(/never translate/i);
  });

  it("tells the model to stay inside the vocabulary under the existing strategy", async () => {
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "Note." });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(describeCuisineField()).toMatch(/empty array when none of them fits/i);
    expect(sentRequest().fill).toMatchObject({
      cuisineFallback: expect.stringMatching(/empty list/i),
    });
  });

  it("invites a name outside the vocabulary under the extend strategy", async () => {
    // Otherwise `extend` is a setting with no effect: the model is never told
    // it may propose one, so nothing unmatched ever reaches the resolver.
    vi.mocked(getCuisineStrategy).mockResolvedValue("extend");
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "Note." });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(describeCuisineField()).toMatch(/name the tradition it does belong to/i);
    expect(sentRequest().fill).toMatchObject({
      cuisineFallback: expect.stringMatching(/name the tradition it does belong to/i),
    });
  });

  it("resolves proposed names to vocabulary row ids", async () => {
    respondWith({
      originCountry: "IT",
      originRegion: null,
      cuisines: ["Italian"],
      provenanceNote: "Note.",
    });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(claim.cuisineIds).toEqual(["id-italian"]);
  });

  it("lands a name the model translated anyway on the row that already means it", async () => {
    // The prompt pins the language; matching is the second line of defence.
    respondWith({
      originCountry: "IT",
      originRegion: null,
      cuisines: ["Italiana"],
      provenanceNote: "Un classico.",
    });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(claim.cuisineIds).toEqual(["id-italian"]);
    expect(createCuisines).not.toHaveBeenCalled();
  });

  it("drops an unmatched name under the existing strategy without creating a row", async () => {
    respondWith({
      originCountry: "IT",
      originRegion: null,
      cuisines: ["Basque", "Italian"],
      provenanceNote: "Note.",
    });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(claim.cuisineIds).toEqual(["id-italian"]);
    expect(createCuisines).not.toHaveBeenCalled();
  });

  it("creates an unmatched name under the extend strategy", async () => {
    vi.mocked(getCuisineStrategy).mockResolvedValue("extend");
    vi.mocked(createCuisines).mockResolvedValue([
      { id: "id-basque", name: "Basque", createdAt: new Date(), version: 1 },
    ]);
    respondWith({
      originCountry: "ES",
      originRegion: null,
      cuisines: ["Basque"],
      provenanceNote: "Note.",
    });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(createCuisines).toHaveBeenCalledWith(["Basque"]);
    expect(claim.cuisineIds).toEqual(["id-basque"]);
  });

  it("tolerates a response with no cuisines field at all", async () => {
    respondWith({ originCountry: "IT", originRegion: null, provenanceNote: "Note." });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(claim.cuisineIds).toEqual([]);
  });

  it("asks for an empty list when the vocabulary is empty", async () => {
    vi.mocked(listCuisines).mockResolvedValue([]);
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "Note." });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(claim.cuisineIds).toEqual([]);
    expect(sentRequest().fill).toMatchObject({
      cuisines: expect.stringContaining("no Cuisines are configured"),
    });
  });
});

describe("the Decision path", () => {
  const NOTE_ONLY = {
    originCountryName: "Italia",
    originRegion: "Lazio",
    provenanceNote: "Un classico romano.",
  };

  /** A Decision answer: the country Choice and one Boolean per vocabulary Cuisine. */
  function decided(
    country: { choice: string; probability: number },
    cuisines: Record<string, number>
  ) {
    return {
      model: "jev-2026-09-01",
      answers: {
        country: {
          type: "choice",
          choice: country.choice,
          probabilities: { [country.choice]: country.probability },
        },
        ...Object.fromEntries(
          VOCABULARY.map((cuisine) => [
            `cuisine:${cuisine.name}`,
            { type: "boolean", probability: cuisines[cuisine.name] ?? 0.01 },
          ])
        ),
      },
    };
  }

  beforeEach(() => {
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
    mocked.decide.mockResolvedValue(decided({ choice: "IT", probability: 0.93 }, { Italian: 0.9 }));
    respondWith(NOTE_ONLY);
  });

  it("offers the world's countries as one Choice inside the provider's limit", () => {
    const criteria = countryChoiceCriteria();
    const codes = Object.keys(criteria);

    expect(codes.length).toBeLessThanOrEqual(255);
    expect(codes.length).toBeGreaterThan(240);
    expect(criteria.IT).toBe("Italy");
    expect(criteria.NL).toBe("Netherlands");
    // Deprecated aliases and pseudo-locales are not countries a dish comes from.
    expect(criteria).not.toHaveProperty("UK");
    expect(criteria).not.toHaveProperty("XA");
    expect(new Set(Object.values(criteria)).size).toBe(codes.length);
  });

  it("settles a clear country and its clear Cuisines by one Decision, and asks the language model for the rest", async () => {
    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(vi.mocked(isDecisionUseEnabled)).toHaveBeenCalledWith("recipeProvenance");
    expect(mocked.decide).toHaveBeenCalledTimes(1);
    const asked = mocked.decide.mock.calls[0]?.[0];

    expect(asked.feature).toBe("recipe-provenance");
    expect(asked.state).toEqual({
      title: "Cacio e Pepe",
      description: "Un primo piatto romano",
      ingredients: ["spaghetti", "pecorino romano", "pepe nero"],
    });
    expect(asked.questions.country.type).toBe("choice");
    expect(asked.questions.country.criteria.IT).toBe("Italy");
    expect(asked.questions["cuisine:Italian"]).toEqual({
      type: "boolean",
      instructions: expect.stringMatching(/Italian/),
    });
    expect(asked.questions["cuisine:Dutch"]).toBeDefined();

    const request = sentRequest();

    // The settled slots travel as the section the gap-fill already uses, and
    // the schema no longer asks for them.
    expect(request.sections.join("\n")).toContain("- originCountry: IT");
    expect(request.sections.join("\n")).toContain("- cuisines: Italian");
    expect(request.schema.shape).not.toHaveProperty("originCountry");
    expect(request.schema.shape).not.toHaveProperty("cuisines");
    expect(request.schema.shape).toHaveProperty("provenanceNote");

    expect(claim).toEqual({
      originCountry: "IT",
      originCountryName: "Italia",
      originRegion: "Lazio",
      provenanceNote: "Un classico romano.",
      cuisineIds: ["id-italian"],
    });
    // A settled Cuisine is a vocabulary row already: nothing is resolved or minted.
    expect(createCuisines).not.toHaveBeenCalled();
    expect(mocked.verifyClaims).not.toHaveBeenCalled();
  });

  it("settles a country at exactly the threshold and not one just below it", async () => {
    expect(COUNTRY_THRESHOLD).toBe(0.6);

    mocked.decide.mockResolvedValue(decided({ choice: "IT", probability: 0.6 }, { Italian: 0.9 }));
    await expect(inferRecipeProvenance(ITALIAN_RECIPE)).resolves.toMatchObject({
      originCountry: "IT",
    });
    expect(sentRequest().schema.shape).not.toHaveProperty("originCountry");

    mocked.generateStructured.mockClear();
    mocked.decide.mockResolvedValue(decided({ choice: "IT", probability: 0.59 }, { Italian: 0.9 }));
    respondWith({ ...NOTE_ONLY, originCountry: "FR", cuisines: ["Italian"] });
    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    // An unclear country settles nothing, Cuisines included: the whole group
    // is the language model's, exactly as before.
    const request = sentRequest();

    expect(request.schema.shape).toHaveProperty("originCountry");
    expect(request.schema.shape).toHaveProperty("cuisines");
    expect(request.sections).toEqual([]);
    expect(claim.originCountry).toBe("FR");
  });

  it("settles a Cuisine at exactly the threshold and not one just below it", async () => {
    expect(CUISINE_THRESHOLD).toBe(0.6);

    mocked.decide.mockResolvedValue(
      decided({ choice: "IT", probability: 0.9 }, { Italian: 0.6, Japanese: 0.59 })
    );

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(claim.cuisineIds).toEqual(["id-italian"]);
  });

  it("leaves the Cuisines to the language model when none clears the threshold, settling only the country", async () => {
    mocked.decide.mockResolvedValue(decided({ choice: "IT", probability: 0.9 }, {}));
    respondWith({ ...NOTE_ONLY, cuisines: ["Italiana"] });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    const request = sentRequest();

    expect(request.schema.shape).not.toHaveProperty("originCountry");
    expect(request.schema.shape).toHaveProperty("cuisines");
    // The language model's Cuisines still go through validation and the resolver.
    expect(mocked.verifyClaims).toHaveBeenCalledWith(
      expect.objectContaining({ claims: [{ id: "Italiana", question: expect.any(String) }] })
    );
    expect(claim).toMatchObject({ originCountry: "IT", cuisineIds: ["id-italian"] });
  });

  it("does not ask the country when it is supplied, and settles the Cuisines around it", async () => {
    mocked.decide.mockResolvedValue({
      model: "jev",
      answers: Object.fromEntries(
        VOCABULARY.map((cuisine) => [
          `cuisine:${cuisine.name}`,
          { type: "boolean", probability: cuisine.name === "Italian" ? 0.95 : 0.01 },
        ])
      ),
    });

    const claim = await inferRecipeProvenance({
      ...ITALIAN_RECIPE,
      supplied: { originCountry: "IT", provenanceNote: "Nonna's." },
    });

    const asked = mocked.decide.mock.calls[0]?.[0];

    expect(asked.questions).not.toHaveProperty("country");
    expect(Object.keys(asked.questions)).toHaveLength(VOCABULARY.length);
    const section = sentRequest().sections.join("\n");

    expect(section).toContain("- originCountry: IT");
    expect(section).toContain("- provenanceNote: Nonna's.");
    expect(section).toContain("- cuisines: Italian");
    expect(claim.cuisineIds).toEqual(["id-italian"]);
  });

  it("asks nothing when every slot it could settle is supplied", async () => {
    respondWith({ ...NOTE_ONLY, originCountry: "IT", cuisines: ["Italian"] });

    await inferRecipeProvenance({
      ...ITALIAN_RECIPE,
      supplied: { originCountry: "IT", cuisineNames: ["Italian"] },
    });

    expect(mocked.decide).not.toHaveBeenCalled();
  });

  it("splits a vocabulary larger than one Decision carries into several requests", async () => {
    const vocabulary = Array.from({ length: 60 }, (_, index) => ({
      id: `id-${index}`,
      name: `Cuisine ${index}`,
      createdAt: new Date(),
      version: 1,
    }));

    vi.mocked(listCuisines).mockResolvedValue(vocabulary);
    mocked.decide.mockImplementation(
      ({ questions }: { questions: Record<string, { type: string }> }) =>
        Promise.resolve({
          model: "jev",
          answers: Object.fromEntries(
            Object.entries(questions).map(([id, question]) =>
              question.type === "choice"
                ? [id, { type: "choice", choice: "IT", probabilities: { IT: 0.9 } }]
                : [id, { type: "boolean", probability: id === "cuisine:Cuisine 59" ? 0.9 : 0.01 }]
            )
          ),
        })
    );

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(mocked.decide).toHaveBeenCalledTimes(2);
    expect(Object.keys(mocked.decide.mock.calls[0]?.[0].questions)).toHaveLength(40);
    expect(Object.keys(mocked.decide.mock.calls[1]?.[0].questions)).toHaveLength(21);
    expect(claim).toMatchObject({ originCountry: "IT", cuisineIds: ["id-59"] });
  });

  it("never mints a Cuisine outside the vocabulary on the Decision path", async () => {
    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(createCuisines).not.toHaveBeenCalled();
    // The schema did not even ask for Cuisines, so there is nothing to resolve.
    expect(sentRequest().schema.shape).not.toHaveProperty("cuisines");
  });

  it("takes today's single inference under the extend strategy", async () => {
    vi.mocked(getCuisineStrategy).mockResolvedValue("extend");
    respondWith({ ...NOTE_ONLY, originCountry: "IT", cuisines: ["Italian"] });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(mocked.decide).not.toHaveBeenCalled();
    expect(sentRequest().schema.shape).toHaveProperty("originCountry");
    expect(claim.originCountry).toBe("IT");
  });

  it("takes today's single inference when the use is switched off", async () => {
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    respondWith({ ...NOTE_ONLY, originCountry: "IT", cuisines: ["Italian"] });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(mocked.decide).not.toHaveBeenCalled();
    expect(sentRequest().sections).toEqual([]);
  });

  it.each([
    ["a non-retryable failure", new AIDisabledError()],
    ["a retryable failure", new AIProviderError("overloaded", { retryable: true })],
    ["an unexpected error", new Error("socket hang up")],
  ])("falls back to the language model on %s", async (_case, failure) => {
    mocked.decide.mockRejectedValue(failure);
    respondWith({ ...NOTE_ONLY, originCountry: "IT", cuisines: ["Italian"] });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(sentRequest().schema.shape).toHaveProperty("originCountry");
    expect(claim).toMatchObject({ originCountry: "IT", cuisineIds: ["id-italian"] });
  });

  it("says which path settled the claim", async () => {
    await inferRecipeProvenance(ITALIAN_RECIPE);

    const { aiLogger } = await import("@norish/shared-server/logger");

    expect(aiLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ path: "decision", settled: { country: true, cuisines: true } }),
      "Recipe Provenance inference completed"
    );
  });
});

describe("Enrichment Validation of the language model's claims", () => {
  const RESPONSE = {
    originCountry: "IT",
    originCountryName: "Italia",
    originRegion: null,
    cuisines: ["Italian", "Japanese"],
    provenanceNote: "Nota.",
  };

  it("checks the language model's Cuisines before resolving them, and attaches only the survivors", async () => {
    respondWith(RESPONSE);
    mocked.verifyClaims.mockImplementation(({ claims }: { claims: { id: string }[] }) => {
      if (claims[0]?.id === "IT")
        return Promise.resolve({ kept: claims, dropped: [], mode: "shadow" });

      return Promise.resolve({
        kept: claims.filter((claim) => claim.id === "Italian"),
        dropped: [{ claim: { id: "Japanese" }, probability: 0.02 }],
        mode: "enforce",
      });
    });

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(mocked.verifyClaims).toHaveBeenCalledWith({
      feature: "recipe-provenance",
      state: expect.objectContaining({ title: "Cacio e Pepe" }),
      claims: [
        { id: "Italian", question: expect.stringMatching(/Italian/) },
        { id: "Japanese", question: expect.stringMatching(/Japanese/) },
      ],
    });
    expect(claim.cuisineIds).toEqual(["id-italian"]);
  });

  it("does not mint a disputed Cuisine under the extend strategy", async () => {
    vi.mocked(getCuisineStrategy).mockResolvedValue("extend");
    respondWith({ ...RESPONSE, cuisines: ["Basque"] });
    mocked.verifyClaims.mockImplementation(({ claims }: { claims: { id: string }[] }) =>
      Promise.resolve(
        claims[0]?.id === "Basque"
          ? { kept: [], dropped: [{ claim: claims[0], probability: 0.1 }], mode: "enforce" }
          : { kept: claims, dropped: [], mode: "shadow" }
      )
    );

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(createCuisines).not.toHaveBeenCalled();
    expect(claim.cuisineIds).toEqual([]);
  });

  it("checks the language model's country in shadow and changes nothing", async () => {
    respondWith(RESPONSE);
    mocked.verifyClaims.mockImplementation(
      ({ claims, mode }: { claims: { id: string }[]; mode?: string }) =>
        Promise.resolve(
          mode === "shadow"
            ? { kept: claims, dropped: [], mode: "shadow" }
            : { kept: claims, dropped: [], mode: "enforce" }
        )
    );

    const claim = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(mocked.verifyClaims).toHaveBeenCalledWith({
      feature: "recipe-provenance",
      state: expect.objectContaining({ title: "Cacio e Pepe" }),
      claims: [{ id: "IT", question: "Is this dish from Italy?" }],
      mode: "shadow",
    });
    expect(claim.originCountry).toBe("IT");
  });

  it("fails the run for a retry when a disputed country is enforced", async () => {
    respondWith(RESPONSE);
    mocked.verifyClaims.mockImplementation(({ claims }: { claims: { id: string }[] }) =>
      Promise.resolve(
        claims[0]?.id === "IT"
          ? { kept: [], dropped: [{ claim: claims[0], probability: 0.05 }], mode: "enforce" }
          : { kept: claims, dropped: [], mode: "enforce" }
      )
    );

    const error = await inferRecipeProvenance(ITALIAN_RECIPE).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AIResponseError);
    expect((error as AIResponseError).retryable).toBe(true);
    expect(createCuisines).not.toHaveBeenCalled();
  });

  it("validates nothing when the language model claimed no Cuisines and no country", async () => {
    respondWith({ ...RESPONSE, originCountry: null, cuisines: [] });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(mocked.verifyClaims).toHaveBeenCalledTimes(1);
    expect(mocked.verifyClaims).toHaveBeenCalledWith(expect.objectContaining({ claims: [] }));
  });
});
