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
import { fillPrompt, loadPrompt } from "@norish/shared-server/ai/prompts/loader";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(({ schema }) => schema) },
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled: vi.fn(),
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

function respondWith(output: unknown) {
  vi.mocked(generateText).mockResolvedValue({
    output,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAIEnabled).mockResolvedValue(true);
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
    respondWith({ originCountry: "IT", originRegion: null, provenanceNote: "Un classico." });

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
    respondWith({ originCountry: "IT", originRegion: null, provenanceNote: note });

    const result = await inferRecipeProvenance(recipe);

    expect(result.success).toBe(true);
    expect(result.success && result.data.provenanceNote).toBe(note);
  });

  it("fails without writing when the response is empty", async () => {
    respondWith(undefined);

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result).toMatchObject({ success: false, code: "EMPTY_RESPONSE" });
  });

  it("fails without writing when the response carries no usable note", async () => {
    respondWith({ originCountry: "IT", originRegion: null, provenanceNote: "   " });

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("reports a provider failure as an ordinary retryable AI failure", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("provider timed out"));

    const result = await inferRecipeProvenance(ITALIAN_RECIPE);

    expect(result.success).toBe(false);
  });
});
