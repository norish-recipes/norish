import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildRecipeExtractionSections,
  buildVideoExtractionSections,
} from "@norish/api/parser/extraction-prompts";
import { recipeExtractionSchema } from "@norish/api/parser/extraction.schema";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

const IMAGE_EXTRACTION_PROMPT = readFileSync(
  join(
    resolveExistingWorkspacePath(join("packages", "shared-server", "src", "ai", "prompts")),
    "image-extraction.txt"
  ),
  "utf-8"
);

describe("extraction inputs request no inference", () => {
  it("builds the HTML sections without tagging or allergy instructions", () => {
    const sections = buildRecipeExtractionSections("WEBPAGE", { url: "https://example.com" });
    const composed = sections.join("\n\n");

    expect(composed).toContain("WEBPAGE");
    expect(composed).toContain("URL: https://example.com");
    expect(composed).not.toMatch(/TAGGING INSTRUCTIONS/i);
    expect(composed).not.toMatch(/ALLERGY DETECTION/i);
  });

  it("ships an image-extraction prompt without tagging, allergy, or categorization instructions", () => {
    // Image extraction runs under its own administrator-editable prompt; the
    // shipped default is what a deployment actually sends.
    expect(IMAGE_EXTRACTION_PROMPT).not.toMatch(/TAGGING INSTRUCTIONS/i);
    expect(IMAGE_EXTRACTION_PROMPT).not.toMatch(/ALLERGY DETECTION/i);
    expect(IMAGE_EXTRACTION_PROMPT).not.toMatch(/Categorize the recipe as/i);
    // It reads images, and says so — never a rewritten webpage prompt.
    expect(IMAGE_EXTRACTION_PROMPT).toMatch(/images/i);
    expect(IMAGE_EXTRACTION_PROMPT).toMatch(/combine them into a single complete recipe/i);
  });

  it("builds the video sections without tagging or allergy instructions", () => {
    const sections = buildVideoExtractionSections("TRANSCRIPT", {
      title: "Pasta",
      duration: 120,
      url: "https://example.com/video",
    });
    const composed = sections.join("\n\n");

    expect(composed).toContain("TRANSCRIPT");
    expect(composed).not.toMatch(/TAGGING INSTRUCTIONS/i);
    expect(composed).not.toMatch(/ALLERGY DETECTION/i);
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
