import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node

const mockFindExistingRecipe = vi.fn();
const mockCreateRecipeWithRefs = vi.fn();
const mockUpdateRecipeWithRefs = vi.fn();
const mockDashboardRecipe = vi.fn();
const mockRateRecipe = vi.fn();
const mockParseMelaArchive = vi.fn();
const mockParseMelaRecipeToDTO = vi.fn();
const mockExtractPaprikaRecipes = vi.fn();
const mockParsePaprikaRecipeToDTO = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn().mockRejectedValue(new Error("missing")),
    mkdir: vi.fn(),
    cp: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: "/tmp/uploads",
  },
}));

vi.mock("@norish/db", () => ({
  findExistingRecipe: mockFindExistingRecipe,
  createRecipeWithRefs: mockCreateRecipeWithRefs,
  updateRecipeWithRefs: mockUpdateRecipeWithRefs,
  dashboardRecipe: mockDashboardRecipe,
}));

vi.mock("@norish/db/repositories/ratings", () => ({
  rateRecipe: mockRateRecipe,
}));

vi.mock("@norish/shared-server/archive/mela-parser", () => ({
  parseMelaArchive: mockParseMelaArchive,
  parseMelaRecipeToDTO: mockParseMelaRecipeToDTO,
}));

vi.mock("@norish/shared-server/archive/mealie-parser", () => ({
  parseMealieArchive: vi.fn(),
  parseMealieRecipeToDTO: vi.fn(),
  extractMealieRecipeImage: vi.fn(),
  buildMealieLookups: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/tandoor-parser", () => ({
  extractTandoorRecipes: vi.fn(),
  parseTandoorRecipeToDTO: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/paprika-parser", () => ({
  extractPaprikaRecipes: mockExtractPaprikaRecipes,
  parsePaprikaRecipeToDTO: mockParsePaprikaRecipeToDTO,
}));

describe("archive importer overwrite behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockParseMelaArchive.mockResolvedValue([{ id: "raw-1" }]);
    mockParseMelaRecipeToDTO.mockImplementation(async (_raw, recipeId) => ({
      id: recipeId,
      name: "Updated Soup",
      description: "new description",
      url: "https://example.com/soup",
      image: `/recipes/${recipeId}/cover.jpg`,
      servings: 2,
      systemUsed: "metric",
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      categories: [],
      tags: [],
      recipeIngredients: [],
      steps: [],
      images: [{ image: `/recipes/${recipeId}/gallery.jpg`, order: 0 }],
      videos: [],
    }));

    mockExtractPaprikaRecipes.mockResolvedValue([]);
    mockParsePaprikaRecipeToDTO.mockImplementation(async (_raw, recipeId) => ({
      id: recipeId,
      name: "Paprika Soup",
      description: "paprika description",
      url: "https://example.com/paprika-soup",
      image: null,
      servings: 2,
      systemUsed: "metric",
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      categories: [],
      tags: [],
      recipeIngredients: [],
      steps: [],
      images: [],
      videos: [],
    }));
  });

  it("overwrites existing imported recipes instead of skipping them", async () => {
    mockFindExistingRecipe.mockResolvedValue("existing-recipe-id");
    mockDashboardRecipe.mockResolvedValue({ id: "existing-recipe-id", name: "Updated Soup" });

    const zip = new JSZip();

    zip.file("recipe.melarecipe", JSON.stringify({ title: "Updated Soup" }));
    const zipBytes = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const { importArchive } = await import("@norish/shared-server/archive/parser");
    const result = await importArchive("user-1", ["user-1"], zipBytes);

    expect(mockUpdateRecipeWithRefs).toHaveBeenCalledWith(
      "existing-recipe-id",
      "user-1",
      expect.objectContaining({
        id: "existing-recipe-id",
        name: "Updated Soup",
        image: "/recipes/existing-recipe-id/cover.jpg",
        images: [{ image: "/recipes/existing-recipe-id/gallery.jpg", order: 0 }],
      })
    );
    expect(mockCreateRecipeWithRefs).not.toHaveBeenCalled();
    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it("allocates the archive recipe ID in parser.ts and persists the same ID", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockImplementation(async (recipeId) => recipeId);
    mockDashboardRecipe.mockImplementation(async (recipeId) => ({
      id: recipeId,
      name: "Updated Soup",
    }));

    const zip = new JSZip();

    zip.file("recipe.melarecipe", JSON.stringify({ title: "Updated Soup" }));
    const zipBytes = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const { importArchive } = await import("@norish/shared-server/archive/parser");

    await importArchive("user-1", ["user-1"], zipBytes);

    const parserRecipeId = mockParseMelaRecipeToDTO.mock.calls[0]?.[1];

    expect(parserRecipeId).toEqual(expect.any(String));
    expect(mockCreateRecipeWithRefs).toHaveBeenCalledWith(
      parserRecipeId,
      "user-1",
      expect.objectContaining({ id: parserRecipeId, name: "Updated Soup" })
    );
  });

  it("imports Paprika rating when greater than zero", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockResolvedValue("new-recipe-id");
    mockDashboardRecipe.mockResolvedValue({ id: "new-recipe-id", name: "Paprika Soup" });
    mockExtractPaprikaRecipes.mockResolvedValue([
      {
        recipe: { name: "Paprika Soup", rating: 5 },
        fileName: "recipe.paprikarecipe",
        image: undefined,
      },
    ]);

    const zip = new JSZip();

    zip.file("recipe.paprikarecipe", "dummy");
    const zipBytes = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const { importArchive } = await import("@norish/shared-server/archive/parser");

    await importArchive("user-1", ["user-1"], zipBytes);

    expect(mockRateRecipe).toHaveBeenCalledWith("user-1", "new-recipe-id", 5);
  });

  it("does not import Paprika rating when it is zero", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockResolvedValue("new-recipe-id");
    mockDashboardRecipe.mockResolvedValue({ id: "new-recipe-id", name: "Paprika Soup" });
    mockExtractPaprikaRecipes.mockResolvedValue([
      {
        recipe: { name: "Paprika Soup", rating: 0 },
        fileName: "recipe.paprikarecipe",
        image: undefined,
      },
    ]);

    const zip = new JSZip();

    zip.file("recipe.paprikarecipe", "dummy");
    const zipBytes = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const { importArchive } = await import("@norish/shared-server/archive/parser");

    await importArchive("user-1", ["user-1"], zipBytes);

    expect(mockRateRecipe).not.toHaveBeenCalled();
  });
});
