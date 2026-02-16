import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

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

vi.mock("@/server/db", () => ({
  findExistingRecipe: mockFindExistingRecipe,
  createRecipeWithRefs: mockCreateRecipeWithRefs,
  updateRecipeWithRefs: mockUpdateRecipeWithRefs,
  dashboardRecipe: mockDashboardRecipe,
}));

vi.mock("@/server/db/repositories/ratings", () => ({
  rateRecipe: mockRateRecipe,
}));

vi.mock("@/server/importers/mela-parser", () => ({
  parseMelaArchive: mockParseMelaArchive,
  parseMelaRecipeToDTO: mockParseMelaRecipeToDTO,
}));

vi.mock("@/server/importers/mealie-parser", () => ({
  parseMealieArchive: vi.fn(),
  parseMealieRecipeToDTO: vi.fn(),
  extractMealieRecipeImage: vi.fn(),
  buildMealieLookups: vi.fn(),
}));

vi.mock("@/server/importers/tandoor-parser", () => ({
  extractTandoorRecipes: vi.fn(),
  parseTandoorRecipeToDTO: vi.fn(),
}));

vi.mock("@/server/importers/paprika-parser", () => ({
  extractPaprikaRecipes: mockExtractPaprikaRecipes,
  parsePaprikaRecipeToDTO: mockParsePaprikaRecipeToDTO,
}));

describe("archive importer overwrite behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockParseMelaArchive.mockResolvedValue([{ id: "raw-1" }]);
    mockParseMelaRecipeToDTO.mockResolvedValue({
      name: "Updated Soup",
      description: "new description",
      url: "https://example.com/soup",
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
    });

    mockExtractPaprikaRecipes.mockResolvedValue([]);
    mockParsePaprikaRecipeToDTO.mockResolvedValue({
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
    });
  });

  it("overwrites existing imported recipes instead of skipping them", async () => {
    mockFindExistingRecipe.mockResolvedValue("existing-recipe-id");
    mockDashboardRecipe.mockResolvedValue({ id: "existing-recipe-id", name: "Updated Soup" });

    const zip = new JSZip();

    zip.file("recipe.melarecipe", JSON.stringify({ title: "Updated Soup" }));
    const zipBytes = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const { importArchive } = await import("@/server/importers/archive-parser");
    const result = await importArchive("user-1", ["user-1"], zipBytes);

    expect(mockUpdateRecipeWithRefs).toHaveBeenCalledWith(
      "existing-recipe-id",
      "user-1",
      expect.objectContaining({ name: "Updated Soup" })
    );
    expect(mockCreateRecipeWithRefs).not.toHaveBeenCalled();
    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
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

    const { importArchive } = await import("@/server/importers/archive-parser");

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

    const { importArchive } = await import("@/server/importers/archive-parser");

    await importArchive("user-1", ["user-1"], zipBytes);

    expect(mockRateRecipe).not.toHaveBeenCalled();
  });
});
