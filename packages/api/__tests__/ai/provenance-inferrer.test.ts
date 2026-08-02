/**
 * Recipe Provenance inference.
 *
 * Only the external AI provider is mocked. What matters here is what reaches
 * the model and what survives coming back: the note's language follows the
 * recipe's, and an unusable response fails without anything being written.
 *
 * @vitest-environment node
 */
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inferRecipeProvenance } from "@norish/api/ai/provenance-inferrer";
import { createCuisines, listCuisines } from "@norish/db/repositories/cuisines";
import { fillPrompt, loadPrompt } from "@norish/shared-server/ai/prompts/loader";
import { getCuisineStrategy, isAIEnabled } from "@norish/shared-server/config/server-config-loader";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(({ schema }) => schema) },
}));

vi.mock("@norish/db/repositories/cuisines", () => ({
  listCuisines: vi.fn(),
  createCuisines: vi.fn(),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled: vi.fn(),
  getCuisineStrategy: vi.fn(),
  getAIConfig: vi.fn().mockResolvedValue({
    enabled: true,
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "test-key",
  }),
}));

vi.mock("@norish/shared-server/ai/providers", () => ({
  getModels: vi.fn().mockResolvedValue({ model: {}, providerName: "openai" }),
  getGenerationSettings: vi.fn().mockResolvedValue({ temperature: 0.7, maxTokens: 4096 }),
}));

vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadPrompt: vi.fn(),
  fillPrompt: vi.fn(
    (template: string, vars: Record<string, string>) =>
      `${template}\n${Object.entries(vars)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}`
  ),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

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
  vi.mocked(generateText).mockResolvedValue({
    output,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAIEnabled).mockResolvedValue(true);
  vi.mocked(getCuisineStrategy).mockResolvedValue("existing");
  vi.mocked(listCuisines).mockResolvedValue(VOCABULARY);
  vi.mocked(createCuisines).mockResolvedValue([]);
  vi.mocked(loadPrompt).mockResolvedValue("Work out where this recipe comes from.");
});

describe("inferRecipeProvenance", () => {
  it("is inert rather than broken when AI is globally disabled", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(false);

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result).toMatchObject({ success: false, code: "AI_DISABLED" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("refuses a recipe with no ingredients", async () => {
    const result = await inferRecipeProvenance({ ...ITALIAN_RECIPE, ingredients: [] });

    expect(result).toMatchObject({ success: false, code: "INVALID_INPUT" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("uses the administrator-editable prompt", async () => {
    respondWith({
      originCountry: "IT",
      originRegion: "Roma",
      cuisines: [],
      provenanceNote: "Un classico romano.",
    });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(loadPrompt).toHaveBeenCalledWith("recipe-provenance");
    expect(fillPrompt).toHaveBeenCalledWith(
      "Work out where this recipe comes from.",
      expect.objectContaining({ recipeName: "Cacio e Pepe" })
    );
  });

  it("sends only the stored recipe, never how it entered Norish", async () => {
    respondWith({
      originCountry: "IT",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Un classico.",
    });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    const { prompt, system } = vi.mocked(generateText).mock.calls[0]?.[0] as {
      prompt: string;
      system: string;
    };

    expect(prompt).toContain("Cacio e Pepe");
    expect(prompt).toContain("pecorino romano");
    // Nothing about parsing, importing, or the source URL reaches the model.
    expect(prompt).not.toMatch(/import|parser|url|http/i);
    // And nothing names a language: the prompt decides that from the recipe.
    expect(system).not.toMatch(/english|language/i);
  });

  it.each([
    [ITALIAN_RECIPE, "Questa ricetta è un classico della cucina romana."],
    [DUTCH_RECIPE, "Dit gerecht is een Hollandse winterklassieker."],
  ])("returns the note in the recipe's own language", async (recipe, note) => {
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: note });

    const result = await inferRecipeProvenance(recipe);

    expect(result.success).toBe(true);
    expect(result.success && result.data.provenanceNote).toBe(note);
  });

  it("carries the country's written name beside the code", async () => {
    respondWith({
      originCountry: "TR",
      originCountryName: "Turkije",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Dit gerecht komt uit de Turkse keuken.",
    });

    const result = await inferRecipeProvenance(DUTCH_RECIPE);

    expect(result.success && result.data.originCountry).toBe("TR");
    expect(result.success && result.data.originCountryName).toBe("Turkije");
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

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success && result.data.originCountryName).toBe(null);
  });

  it("degrades a blank written name to null so the endonym fallback applies", async () => {
    respondWith({
      originCountry: "IT",
      originCountryName: "   ",
      originRegion: null,
      cuisines: [],
      provenanceNote: "Nota.",
    });

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success && result.data.originCountry).toBe("IT");
    expect(result.success && result.data.originCountryName).toBe(null);
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

    const schema = vi.mocked(generateText).mock.calls[0]?.[0].output as unknown as {
      shape: {
        originCountry: { description?: string };
        originCountryName: { description?: string };
      };
    };

    expect(schema.shape.originCountry.description).toMatch(/strongest claim/i);
    expect(schema.shape.originCountry.description).toMatch(/null only when/i);
    expect(schema.shape.originCountryName.description).toMatch(
      /language the recipe itself is written in/i
    );
  });

  it("fails without writing when the response is empty", async () => {
    respondWith(undefined);

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result).toMatchObject({ success: false, code: "EMPTY_RESPONSE" });
  });

  it("fails without writing when the response carries no usable note", async () => {
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "   " });

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("reports a provider failure as an ordinary retryable AI failure", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("provider timed out"));

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success).toBe(false);
  });
});

describe("Cuisines", () => {
  function describeCuisineField(): string {
    const schema = vi.mocked(generateText).mock.calls[0]?.[0].output as unknown as {
      shape: { cuisines: { description?: string } };
    };

    return schema.shape.cuisines.description ?? "";
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

    expect(fillPrompt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cuisines: "Italian, Japanese, Dutch" })
    );
    expect(describeCuisineField()).toMatch(/never translate/i);
  });

  it("tells the model to stay inside the vocabulary under the existing strategy", async () => {
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "Note." });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(describeCuisineField()).toMatch(/empty array when none of them fits/i);
    expect(fillPrompt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cuisineFallback: expect.stringMatching(/empty list/i) })
    );
  });

  it("invites a name outside the vocabulary under the extend strategy", async () => {
    // Otherwise `extend` is a setting with no effect: the model is never told
    // it may propose one, so nothing unmatched ever reaches the resolver.
    vi.mocked(getCuisineStrategy).mockResolvedValue("extend");
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "Note." });

    await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(describeCuisineField()).toMatch(/name the tradition it does belong to/i);
    expect(fillPrompt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cuisineFallback: expect.stringMatching(/name the tradition it does belong to/i),
      })
    );
  });

  it("resolves proposed names to vocabulary row ids", async () => {
    respondWith({
      originCountry: "IT",
      originRegion: null,
      cuisines: ["Italian"],
      provenanceNote: "Note.",
    });

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success && result.data.cuisineIds).toEqual(["id-italian"]);
  });

  it("lands a name the model translated anyway on the row that already means it", async () => {
    // The prompt pins the language; matching is the second line of defence.
    respondWith({
      originCountry: "IT",
      originRegion: null,
      cuisines: ["Italiana"],
      provenanceNote: "Un classico.",
    });

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success && result.data.cuisineIds).toEqual(["id-italian"]);
    expect(createCuisines).not.toHaveBeenCalled();
  });

  it("drops an unmatched name under the existing strategy without creating a row", async () => {
    respondWith({
      originCountry: "IT",
      originRegion: null,
      cuisines: ["Basque", "Italian"],
      provenanceNote: "Note.",
    });

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success && result.data.cuisineIds).toEqual(["id-italian"]);
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

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(createCuisines).toHaveBeenCalledWith(["Basque"]);
    expect(result.success && result.data.cuisineIds).toEqual(["id-basque"]);
  });

  it("tolerates a response with no cuisines field at all", async () => {
    respondWith({ originCountry: "IT", originRegion: null, provenanceNote: "Note." });

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success && result.data.cuisineIds).toEqual([]);
  });

  it("asks for an empty list when the vocabulary is empty", async () => {
    vi.mocked(listCuisines).mockResolvedValue([]);
    respondWith({ originCountry: "IT", originRegion: null, cuisines: [], provenanceNote: "Note." });

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success && result.data.cuisineIds).toEqual([]);
    expect(fillPrompt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cuisines: expect.stringContaining("no Cuisines are configured") })
    );
  });
});
