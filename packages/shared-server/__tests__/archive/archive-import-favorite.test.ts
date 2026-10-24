import JSZip from "jszip";
import { beforeAll, describe, expect, it, vi } from "vitest";

// @vitest-environment node

const mockFindExistingRecipe = vi.fn();
const mockCreateRecipeWithRefs = vi.fn();
const mockUpdateRecipeWithRefs = vi.fn();
const mockDashboardRecipe = vi.fn();
const mockRateRecipe = vi.fn();
const mockAddFavorite = vi.fn();
const mockParseMelaArchive = vi.fn();
const mockParseMelaRecipeToDTO = vi.fn();

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

vi.mock("@norish/shared-server/ingredients/recipe-lines", () => ({
  withResolvedIngredients: vi.fn(async (payload: object) => ({
    ...payload,
    ingredientResolutions: new Map(),
  })),
  createResolvedRecipe: vi.fn(async (id: string, userId: unknown, payload: object) =>
    mockCreateRecipeWithRefs(id, userId, { ...payload, ingredientResolutions: new Map() })
  ),
  updateResolvedRecipe: vi.fn(
    async (id: string, userId: unknown, payload: object, _actor: unknown, version?: number) =>
      version === undefined
        ? mockUpdateRecipeWithRefs(id, userId, { ...payload, ingredientResolutions: new Map() })
        : mockUpdateRecipeWithRefs(
            id,
            userId,
            { ...payload, ingredientResolutions: new Map() },
            version
          )
  ),
}));

vi.mock("@norish/db/repositories/ratings", () => ({
  rateRecipe: mockRateRecipe,
}));

vi.mock("@norish/db/repositories/favorites", () => ({
  addFavorite: mockAddFavorite,
}));

vi.mock("@norish/db/repositories/cookbooks", () => ({
  findOwnCookbookIdByTitle: vi.fn(),
  createCookbook: vi.fn(),
  addRecipeToCookbook: vi.fn(),
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
  parseMelaArchive: mockParseMelaArchive,
  parseMelaRecipeToDTO: mockParseMelaRecipeToDTO,
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

vi.mock("@norish/shared-server/archive/recipe-keeper-parser", () => ({
  readRecipeKeeperHtml: vi.fn().mockResolvedValue(null),
  countRecipeKeeperRecipes: vi.fn(),
  extractRecipeKeeperRecipes: vi.fn(),
  parseRecipeKeeperRecipeToDTO: vi.fn(),
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

let parser: typeof import("@norish/shared-server/archive/parser");

// Loaded once, in a hook: the parser's import graph is heavy, and loaded
// inside a test it spent that test's 5 s budget on a busy machine.
beforeAll(async () => {
  parser = await import("@norish/shared-server/archive/parser");
});

describe("archive import loop favourite extra", () => {
  it("applies the favourite to a freshly created recipe for the importing user", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "new-recipe-id" });
    mockDashboardRecipe.mockResolvedValue({ id: "new-recipe-id", name: "Marked Soup" });

    const result = await parser.importRecipeItems(
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

    const result = await parser.importRecipeItems(
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

    await parser.importRecipeItems(
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

    await parser.importRecipeItems(
      itemsOf([{ dto: buildDto("new-recipe-id"), fileName: "recipe_1", importedFavorite: true }]),
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

    const result = await parser.importRecipeItems(
      itemsOf([{ dto: buildDto("new-recipe-id"), fileName: "recipe_1", importedFavorite: true }]),
      "user-1",
      ["user-1"]
    );

    expect(result.imported).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
  it("favourites a Mela recipe its archive marks as a favourite", async () => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "new-recipe-id" });
    mockDashboardRecipe.mockResolvedValue({ id: "new-recipe-id", name: "Marked Soup" });
    mockParseMelaArchive.mockResolvedValue([
      { title: "Marked Soup", favorite: true },
      { title: "Plain Soup", favorite: false },
    ]);
    mockParseMelaRecipeToDTO.mockImplementation(async (_raw, recipeId: string) =>
      buildDto(recipeId)
    );

    const zip = new JSZip();

    zip.file("recipe.melarecipe", "{}");
    const zipBytes = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    await parser.importArchive("user-1", ["user-1"], zipBytes);

    expect(mockAddFavorite).toHaveBeenCalledTimes(1);
  });
});
