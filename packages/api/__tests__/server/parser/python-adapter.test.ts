// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUnits = vi.fn();
const mockParseIngredients = vi.fn();
const mockParseSteps = vi.fn();
const mockParseImages = vi.fn();
const mockParseVideos = vi.fn();

vi.mock("@norish/config/server-config-loader", () => ({
  getUnits: mockGetUnits,
}));

vi.mock("@norish/api/parser/parsers/ingredients", () => ({
  parseIngredients: mockParseIngredients,
}));

vi.mock("@norish/api/parser/parsers/steps", () => ({
  parseSteps: mockParseSteps,
}));

vi.mock("@norish/api/parser/parsers/images", () => ({
  parseImages: mockParseImages,
}));

vi.mock("@norish/api/parser/parsers/videos", () => ({
  parseVideos: mockParseVideos,
}));

vi.mock("@norish/api/parser/parsers/metadata", () => ({
  getServings: vi.fn(() => 4),
}));

vi.mock("@norish/api/parser/parsers/nutrition", () => ({
  extractNutrition: vi.fn(() => ({ calories: null, fat: null, carbs: null, protein: null })),
}));

vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: {
    warn: vi.fn(),
  },
}));

describe("adaptRecipeScrapersResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUnits.mockResolvedValue({});
    mockParseIngredients.mockReturnValue({
      ingredients: [
        {
          ingredientId: null,
          ingredientName: "egg",
          amount: 1,
          unit: null,
          systemUsed: "metric",
          order: 0,
        },
      ],
      systemUsed: "metric",
    });
    mockParseSteps.mockReturnValue([{ step: "Cook it", systemUsed: "metric", order: 1 }]);
    mockParseImages.mockResolvedValue({
      images: [{ image: "/recipes/recipe-1/image.jpg", order: 0 }],
      primaryImage: "/recipes/recipe-1/image.jpg",
    });
    mockParseVideos.mockResolvedValue({
      videos: [
        {
          video: "/recipes/recipe-1/video.mp4",
          thumbnail: "https://cdn.example.com/video.jpg",
          duration: 60,
          order: 0,
        },
      ],
    });
  });

  it("maps parser EmbeddedVideo payloads into VideoObject-shaped input for video handling", async () => {
    const { adaptRecipeScrapersResponse } = await import("@norish/api/parser/python/adapter");

    const result = await adaptRecipeScrapersResponse(
      {
        ok: true,
        canonicalUrl: "https://example.com/canonical-recipe",
        parser: {
          mode: "supported",
          scraper: "ExampleScraper",
          host: "example.com",
          siteName: "Example",
          version: "15.10.0",
        },
        recipe: {
          title: "Example Recipe",
          ingredients: ["1 egg"],
          instructions_list: ["Cook it"],
          keywords: ["Brunch", "Quick"],
          category: ["Dessert"],
          cuisine: "Italian",
          dietary_restrictions: ["Vegetarian"],
        },
        media: {
          images: ["https://cdn.example.com/recipe.jpg"],
          videos: [
            {
              contentUrl: "https://cdn.example.com/video.mp4",
              url: "https://example.com/watch",
              thumbnailUrl: "https://cdn.example.com/video.jpg",
              duration: "PT1M",
              name: "Embedded recipe video",
              description: "Step-by-step video",
            },
          ],
        },
      },
      "recipe-1",
      "https://example.com/original-recipe"
    );

    expect(mockParseVideos).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          "@type": "VideoObject",
          contentUrl: "https://cdn.example.com/video.mp4",
          url: "https://example.com/watch",
        }),
      ],
      "recipe-1"
    );
    expect(result).toEqual(
      expect.objectContaining({
        url: "https://example.com/canonical-recipe",
        image: "/recipes/recipe-1/image.jpg",
        videos: expect.arrayContaining([
          expect.objectContaining({
            video: "/recipes/recipe-1/video.mp4",
          }),
        ]),
        categories: expect.arrayContaining(["Breakfast", "Snack"]),
        tags: [],
      })
    );
    expect(mockParseImages).toHaveBeenCalledWith(
      ["https://cdn.example.com/recipe.jpg"],
      "recipe-1"
    );
  });

  it("falls back to the original URL when canonicalUrl is missing", async () => {
    const { adaptRecipeScrapersResponse } = await import("@norish/api/parser/python/adapter");

    const result = await adaptRecipeScrapersResponse(
      {
        ok: true,
        canonicalUrl: null,
        parser: {
          mode: "supported",
          scraper: "ExampleScraper",
          host: "example.com",
          siteName: "Example",
          version: "15.10.0",
        },
        recipe: {
          title: "Example Recipe",
          ingredients: ["1 egg"],
          instructions_list: ["Cook it"],
        },
        media: {
          images: [],
          videos: [],
        },
      },
      "recipe-1",
      "https://example.com/original-recipe"
    );

    expect(result?.url).toBe("https://example.com/original-recipe");
  });

  it("prefers structured recipeInstructions so HowToStep names are preserved", async () => {
    const { adaptRecipeScrapersResponse } = await import("@norish/api/parser/python/adapter");

    await adaptRecipeScrapersResponse(
      {
        ok: true,
        canonicalUrl: null,
        parser: {
          mode: "supported",
          scraper: "ExampleScraper",
          host: "example.com",
          siteName: "Example",
          version: "15.10.0",
        },
        recipe: {
          title: "Example Recipe",
          ingredients: ["1 egg"],
          instructions_list: ["Plain fallback step"],
          recipeInstructions: [
            {
              "@type": "HowToStep",
              name: "Stap 1",
              text: "Do the first thing",
            },
          ],
        },
        media: {
          images: [],
          videos: [],
        },
      },
      "recipe-1",
      "https://example.com/original-recipe"
    );

    expect(mockParseSteps).toHaveBeenCalledWith(
      [
        {
          "@type": "HowToStep",
          name: "Stap 1",
          text: "Do the first thing",
        },
      ],
      "metric"
    );
  });

  it("prefers recipe.image over media image candidates", async () => {
    const { adaptRecipeScrapersResponse } = await import("@norish/api/parser/python/adapter");

    await adaptRecipeScrapersResponse(
      {
        ok: true,
        canonicalUrl: null,
        parser: {
          mode: "supported",
          scraper: "ExampleScraper",
          host: "example.com",
          siteName: "Example",
          version: "15.10.0",
        },
        recipe: {
          title: "Example Recipe",
          image: "https://cdn.example.com/primary.jpg",
          ingredients: ["1 egg"],
          instructions_list: ["Cook it"],
        },
        media: {
          images: ["https://cdn.example.com/primary.jpg", "https://example.com/not-an-image-page"],
          videos: [],
        },
      },
      "recipe-1",
      "https://example.com/original-recipe"
    );

    expect(mockParseImages).toHaveBeenCalledWith("https://cdn.example.com/primary.jpg", "recipe-1");
  });
});
