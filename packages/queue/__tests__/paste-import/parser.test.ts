// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const mockNormalizeRecipeFromJson = vi.fn(
  async (node: Record<string, unknown>, recipeId: string) => ({
    id: recipeId,
    name: String(node.name ?? "Recipe"),
    description: null,
    notes: null,
    url: null,
    image: null,
    servings: 1,
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
    systemUsed: "metric",
    recipeIngredients: [
      {
        ingredientId: null,
        ingredientName: "Ingredient",
        amount: 1,
        unit: null,
        systemUsed: "metric",
        order: 0,
      },
    ],
    steps: [{ step: "Step", order: 1, systemUsed: "metric" }],
    tags: [],
    categories: [],
    images: [],
    videos: [],
  })
);
const mockParseCategories = vi.fn((value: unknown) =>
  typeof value === "string" && value.toLowerCase() === "breakfast" ? ["Breakfast"] : []
);
const mockParseTags = vi.fn((value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => ({ name: entry.toLowerCase() }))
    : []
);
const mockExtractRecipeNodesFromJsonValue = vi.fn((input: unknown) => {
  const rootNodes = Array.isArray(input) ? input : [input];

  return rootNodes.flatMap((node) => {
    if (!node || typeof node !== "object") {
      return [];
    }

    const record = node as Record<string, unknown>;

    if (record["@type"] === "Recipe") {
      return [record];
    }

    if (Array.isArray(record["@graph"])) {
      return (record["@graph"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          !!entry &&
          typeof entry === "object" &&
          (entry as Record<string, unknown>)["@type"] === "Recipe"
      );
    }

    return [];
  });
});

vi.mock("@norish/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: vi.fn(
    (name: string) =>
      ({
        extractRecipeNodesFromJsonValue: mockExtractRecipeNodesFromJsonValue,
        normalizeRecipeFromJson: mockNormalizeRecipeFromJson,
        parseCategories: mockParseCategories,
        parseTags: mockParseTags,
      })[name]
  ),
}));

describe("preparePasteImport", () => {
  it("prepares batch IDs for JSON-LD arrays", async () => {
    const { preparePasteImport } = await import("../../src/paste-import/parser");

    const result = await preparePasteImport(
      JSON.stringify([
        {
          "@context": "https://schema.org",
          "@type": "Recipe",
          name: "First",
          recipeIngredient: ["1 egg"],
          recipeInstructions: ["Mix"],
          aggregateRating: { ratingValue: 4.5 },
        },
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Recipe",
              name: "Second",
              recipeIngredient: ["2 eggs"],
              recipeInstructions: ["Bake"],
            },
          ],
        },
      ])
    );

    expect(result.recipeIds).toHaveLength(2);
    expect(result.structuredRecipes).toHaveLength(2);
    expect(result.structuredRecipes?.[0]?.importedRating).toBe(4.5);
    expect(result.structuredRecipes?.map((recipe) => recipe.recipeId)).toEqual(
      result.structuredRecipes?.map((recipe) => recipe.recipe.id)
    );
    expect(mockNormalizeRecipeFromJson).toHaveBeenCalledTimes(2);
    expect(mockNormalizeRecipeFromJson.mock.calls[0]?.[1]).toBe(
      result.structuredRecipes?.[0]?.recipeId
    );
    expect(mockNormalizeRecipeFromJson.mock.calls[1]?.[1]).toBe(
      result.structuredRecipes?.[1]?.recipeId
    );
  });

  it("normalizes YAML aliases, tags, and source URL", async () => {
    const { preparePasteImport } = await import("../../src/paste-import/parser");

    const result = await preparePasteImport(`
title: Fancy Toast
ingredients:
  - 2 slices bread
steps:
  - Toast the bread
tags: breakfast, quick, breakfast
categories: Breakfast
image: https://example.com/image.jpg
video: https://example.com/video.mp4
sourceUrl: https://example.com/fancy-toast
rating: 3.6
`);

    expect(result.recipeIds).toHaveLength(1);
    expect(result.structuredRecipes?.[0]?.recipeId).toBe(result.structuredRecipes?.[0]?.recipe.id);
    expect(result.structuredRecipes?.[0]?.recipe.tags).toEqual([
      { name: "breakfast" },
      { name: "quick" },
    ]);
    expect(result.structuredRecipes?.[0]?.recipe.images).toEqual([
      { image: "https://example.com/image.jpg", order: 0 },
    ]);
    expect(result.structuredRecipes?.[0]?.recipe.videos).toEqual([
      {
        video: "https://example.com/video.mp4",
        thumbnail: null,
        duration: null,
        order: 0,
      },
    ]);
    expect(result.structuredRecipes?.[0]?.recipe.url).toBe("https://example.com/fancy-toast");
    expect(result.structuredRecipes?.[0]?.importedRating).toBe(3.6);
  });

  it("rejects structured input when no valid recipes remain", async () => {
    const { preparePasteImport } = await import("../../src/paste-import/parser");

    await expect(
      preparePasteImport(`
title: Broken Recipe
ingredients: not-an-array
steps:
  - Step one
`)
    ).rejects.toThrow("No valid recipes found in structured paste input.");
  });

  it("preserves AI fallback when forceAI is enabled", async () => {
    const { preparePasteImport } = await import("../../src/paste-import/parser");

    const result = await preparePasteImport(
      '{"@type":"Recipe","name":"Ignored","recipeIngredient":["1 egg"],"recipeInstructions":["Mix"]}',
      true
    );

    expect(result.recipeIds).toHaveLength(1);
    expect(result.structuredRecipes).toBeUndefined();
    expect(result.forceAI).toBe(true);
  });

  it("enforces the paste limit per structured recipe instead of on the total payload", async () => {
    const { MAX_RECIPE_PASTE_CHARS } = await import("@norish/shared/contracts/uploads");
    const { preparePasteImport } = await import("../../src/paste-import/parser");

    const oversizedTitle = "a".repeat(MAX_RECIPE_PASTE_CHARS + 1);

    await expect(
      preparePasteImport(`
- title: ${oversizedTitle}
  ingredients:
    - 1 egg
  steps:
    - Mix
`)
    ).rejects.toThrow(`Each pasted recipe must be at most ${MAX_RECIPE_PASTE_CHARS} characters.`);
  });
});
