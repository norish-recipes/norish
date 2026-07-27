import { beforeEach, describe, expect, it, vi } from "vitest";

import { recipeExtractionSchema } from "@norish/api/ai/schemas/recipe.schema";
import { loadPrompt } from "@norish/shared-server/ai/prompts/loader";

vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadPrompt: vi.fn(),
  fillPrompt: vi.fn(),
}));

vi.mock("@norish/db/repositories/tags", () => ({ listAllTagNames: vi.fn() }));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getTagStrategy: vi.fn().mockResolvedValue("freeform"),
}));

const { buildImageExtractionPrompt, buildRecipeExtractionPrompt, buildVideoExtractionPrompt } =
  await import("@norish/api/ai/prompts/builder");

/** A recognizable stand-in so we can tell base prompt from appended instructions. */
const BASE_PROMPT = "BASE EXTRACTION PROMPT";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadPrompt).mockResolvedValue(BASE_PROMPT);
});

describe("extraction prompts request no inference", () => {
  it("builds the HTML prompt without tagging or allergy instructions", async () => {
    const prompt = await buildRecipeExtractionPrompt("WEBPAGE", { url: "https://example.com" });

    expect(prompt).toContain(BASE_PROMPT);
    expect(prompt).toContain("WEBPAGE");
    expect(prompt).not.toMatch(/TAGGING INSTRUCTIONS/i);
    expect(prompt).not.toMatch(/ALLERGY DETECTION/i);
    expect(loadPrompt).toHaveBeenCalledTimes(1);
    expect(loadPrompt).toHaveBeenCalledWith("recipe-extraction");
  });

  it("builds the image prompt without tagging, allergy, or categorization instructions", async () => {
    const prompt = await buildImageExtractionPrompt();

    expect(prompt).not.toMatch(/TAGGING INSTRUCTIONS/i);
    expect(prompt).not.toMatch(/ALLERGY DETECTION/i);
    expect(prompt).not.toMatch(/Categorize the recipe as/i);
  });

  it("builds the video prompt without tagging or allergy instructions", async () => {
    const prompt = await buildVideoExtractionPrompt("TRANSCRIPT", {
      title: "Pasta",
      duration: 120,
      url: "https://example.com/video",
    });

    expect(prompt).toContain("TRANSCRIPT");
    expect(prompt).not.toMatch(/TAGGING INSTRUCTIONS/i);
    expect(prompt).not.toMatch(/ALLERGY DETECTION/i);
  });
});

describe("extraction schema keeps explicit source facts", () => {
  const validOutput = {
    name: "Pasta",
    description: null,
    notes: null,
    recipeYield: 4,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    recipeIngredient: { metric: ["200 g pasta"], us: ["7 oz pasta"] },
    recipeInstructions: { metric: ["Boil"], us: ["Boil"] },
    keywords: ["italian"],
    allergyIndications: [],
    categories: ["Dinner"],
    nutrition: { calories: 500, fat: 10, carbs: 60, protein: 20 },
  };

  it("accepts categories, keywords, and nutrition the source stated", () => {
    const parsed = recipeExtractionSchema.parse(validOutput);

    expect(parsed.categories).toEqual(["Dinner"]);
    expect(parsed.keywords).toEqual(["italian"]);
    expect(parsed.nutrition).toEqual({ calories: 500, fat: 10, carbs: 60, protein: 20 });
  });

  it("accepts allergy indications the source explicitly states", () => {
    const parsed = recipeExtractionSchema.parse({
      ...validOutput,
      allergyIndications: ["Peanut", "Milk"],
    });

    expect(parsed.allergyIndications).toEqual(["Peanut", "Milk"]);
  });

  it("accepts a source that states no categories, rather than forcing a guess", () => {
    const parsed = recipeExtractionSchema.parse({ ...validOutput, categories: [] });

    expect(parsed.categories).toEqual([]);
  });

  it("accepts null for every nutrition field the source does not state", () => {
    const parsed = recipeExtractionSchema.parse({
      ...validOutput,
      nutrition: { calories: null, fat: null, carbs: null, protein: null },
    });

    expect(parsed.nutrition).toEqual({ calories: null, fat: null, carbs: null, protein: null });
  });

  it("accepts partial source nutrition without inventing the rest", () => {
    const parsed = recipeExtractionSchema.parse({
      ...validOutput,
      nutrition: { calories: 500, fat: null, carbs: null, protein: null },
    });

    expect(parsed.nutrition.calories).toBe(500);
    expect(parsed.nutrition.fat).toBeNull();
  });
});
