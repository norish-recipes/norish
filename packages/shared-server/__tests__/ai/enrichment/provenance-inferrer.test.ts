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
import { getCuisineStrategy } from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
}));

vi.mock("@norish/db/repositories/cuisines", () => ({
  listCuisines: vi.fn(),
  createCuisines: vi.fn(),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getCuisineStrategy: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { inferRecipeProvenance } =
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
  vi.mocked(listCuisines).mockResolvedValue(VOCABULARY);
  vi.mocked(createCuisines).mockResolvedValue([]);
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
