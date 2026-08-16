import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node

const mockFindExistingRecipe = vi.fn();
const mockCreateRecipeWithRefs = vi.fn();
const mockUpdateRecipeWithRefs = vi.fn();
const mockDashboardRecipe = vi.fn();
const mockRateRecipe = vi.fn();
const mockAddFavorite = vi.fn();

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

vi.mock("@norish/db/repositories/favorites", () => ({
  addFavorite: mockAddFavorite,
}));

vi.mock("@norish/db/repositories/cuisines", () => ({
  listCuisines: vi.fn().mockResolvedValue([]),
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: vi.fn(),
  saveStepImageBytes: vi.fn(),
  saveVideoBytes: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/mela-parser", () => ({
  parseMelaArchive: vi.fn(),
  parseMelaRecipeToDTO: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/mealie-parser", () => ({
  parseMealieArchive: vi.fn(),
  parseMealieRecipeToDTO: vi.fn(),
  extractMealieRecipeImage: vi.fn(),
  buildMealieLookups: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/mealie-legacy-parser", () => ({
  detectMealieLegacyArchive: vi.fn(),
  extractMealieLegacyImage: vi.fn(),
  extractMealieLegacyRecipes: vi.fn(),
  parseMealieLegacyRecipeToDTO: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/tandoor-parser", () => ({
  extractTandoorRecipes: vi.fn(),
  parseTandoorRecipeToDTO: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/paprika-parser", () => ({
  extractPaprikaRecipes: vi.fn(),
  parsePaprikaRecipeToDTO: vi.fn(),
}));

function buildDto(recipeId: string) {
  return {
    id: recipeId,
    name: "Marked Soup",
    description: null,
    url: "https://example.com/marked-soup",
    image: null,
    servings: 2,
    systemUsed: "metric" as const,
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
  };
}

async function* itemsOf(items: unknown[]) {
  for (const item of items) {
    yield item;
  }
}

describe("archive import loop favourite extra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies the favourite to a freshly created recipe for the importing user", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "new-recipe-id" });
    mockDashboardRecipe.mockResolvedValue({ id: "new-recipe-id", name: "Marked Soup" });

    const { importRecipeItems } = await import("@norish/shared-server/archive/parser");
    const result = await importRecipeItems(
      itemsOf([
        {
          dto: buildDto("new-recipe-id"),
          fileName: "recipe_1",
          importedRating: 4,
          importedFavorite: true,
        },
      ]),
      "user-1",
      ["user-1"]
    );

    expect(mockAddFavorite).toHaveBeenCalledWith("user-1", "new-recipe-id");
    expect(mockRateRecipe).toHaveBeenCalledWith("user-1", "new-recipe-id", 4);
    expect(result.imported).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("applies the favourite to the matched-and-overwritten recipe for the importing user", async () => {
    mockFindExistingRecipe.mockResolvedValue("existing-recipe-id");
    mockDashboardRecipe.mockResolvedValue({ id: "existing-recipe-id", name: "Marked Soup" });

    const { importRecipeItems } = await import("@norish/shared-server/archive/parser");
    const result = await importRecipeItems(
      itemsOf([
        { dto: buildDto("archive-recipe-id"), fileName: "recipe_1", importedFavorite: true },
      ]),
      "user-1",
      ["user-1"]
    );

    expect(mockUpdateRecipeWithRefs).toHaveBeenCalled();
    expect(mockAddFavorite).toHaveBeenCalledWith("user-1", "existing-recipe-id");
    expect(result.imported).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("does not apply a favourite that the archive does not declare", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "new-recipe-id" });
    mockDashboardRecipe.mockResolvedValue({ id: "new-recipe-id", name: "Marked Soup" });

    const { importRecipeItems } = await import("@norish/shared-server/archive/parser");

    await importRecipeItems(
      itemsOf([{ dto: buildDto("new-recipe-id"), fileName: "recipe_1", importedRating: 3 }]),
      "user-1",
      ["user-1"]
    );

    expect(mockAddFavorite).not.toHaveBeenCalled();
  });

  it("does not apply the favourite without an authenticated importing user", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "new-recipe-id" });
    mockDashboardRecipe.mockResolvedValue({ id: "new-recipe-id", name: "Marked Soup" });

    const { importRecipeItems } = await import("@norish/shared-server/archive/parser");

    await importRecipeItems(
      itemsOf([
        { dto: buildDto("new-recipe-id"), fileName: "recipe_1", importedFavorite: true },
      ]),
      undefined,
      ["user-1"]
    );

    expect(mockAddFavorite).not.toHaveBeenCalled();
  });

  it("never fails the import when applying the favourite fails", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "new-recipe-id" });
    mockDashboardRecipe.mockResolvedValue({ id: "new-recipe-id", name: "Marked Soup" });
    mockAddFavorite.mockRejectedValue(new Error("favorites table unavailable"));

    const { importRecipeItems } = await import("@norish/shared-server/archive/parser");
    const result = await importRecipeItems(
      itemsOf([
        { dto: buildDto("new-recipe-id"), fileName: "recipe_1", importedFavorite: true },
      ]),
      "user-1",
      ["user-1"]
    );

    expect(result.imported).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});
