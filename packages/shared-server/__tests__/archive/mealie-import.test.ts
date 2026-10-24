import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node

const mockFindExistingRecipe = vi.fn();
const mockCreateResolvedRecipe = vi.fn();
const mockAddFavorite = vi.fn();
const mockSaveImageBytes = vi.fn();

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { UPLOADS_DIR: "/tmp/uploads" },
}));
vi.mock("@norish/db", async () => ({
  // The real insert schema validates what the parser builds.
  FullRecipeInsertSchema: (await import("@norish/shared/contracts/zod")).FullRecipeInsertSchema,
  findExistingRecipe: mockFindExistingRecipe,
  dashboardRecipe: vi.fn(async (recipeId: string) => ({ id: recipeId })),
}));
vi.mock("@norish/shared-server/ingredients/recipe-lines", () => ({
  createResolvedRecipe: mockCreateResolvedRecipe,
  updateResolvedRecipe: vi.fn(),
}));
vi.mock("@norish/shared-server/media/dish-color", () => ({
  withDishColor: async (dto: unknown) => dto,
  withDishColorForUpdate: async (dto: unknown) => dto,
}));
vi.mock("@norish/db/repositories/ratings", () => ({ rateRecipe: vi.fn() }));
vi.mock("@norish/db/repositories/favorites", () => ({ addFavorite: mockAddFavorite }));
vi.mock("@norish/db/repositories/cuisines", () => ({
  listCuisines: vi.fn().mockResolvedValue([{ id: "italian-id", name: "Italian", version: 1 }]),
}));
vi.mock("@norish/db/repositories/cookbooks", () => ({
  findOwnCookbookIdByTitle: vi.fn(),
  createCookbook: vi.fn(),
  addRecipeToCookbook: vi.fn(),
}));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));
vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: mockSaveImageBytes,
  saveStepImageBytes: vi.fn(),
  saveVideoBytes: vi.fn(),
}));

const { ArchiveFormat, getArchiveInfo, importArchive } =
  await import("@norish/shared-server/archive/parser");

// A SQLite Mealie writes its ids as bare hex.
const RECIPE_ID = "3fa85f6457174562b3fc2c963f66afa6";

/** An admin backup's database.json, trimmed to the tables the importer reads. */
function backupDatabase(overrides: Record<string, unknown> = {}) {
  return {
    recipes: [
      {
        id: RECIPE_ID,
        name: "Tiramisù",
        org_url: "https://example.it/tiramisu",
        recipeCuisine: "italian",
        prep_time: "",
        perform_time: "",
        total_time: "",
        prep_time_seconds: 1800,
        perform_time_seconds: 600,
        total_time_seconds: 2700,
      },
    ],
    recipes_ingredients: [
      {
        id: 1,
        recipe_id: RECIPE_ID,
        position: 0,
        title: "Per la crema",
        food_id: "food-mascarpone",
        unit_id: "unit-gram",
        quantity: 500,
        note: "cold",
        original_text: "1 tub mascarpone",
        reference_id: "aaaaaaaa-0000-4000-8000-000000000001",
      },
      {
        // Before Mealie 3.1 an unparsed line was quantity 1 with its whole
        // text in the note.
        id: 2,
        recipe_id: RECIPE_ID,
        position: 1,
        food_id: null,
        quantity: 1,
        note: "3 eggs",
        reference_id: "aaaaaaaa-0000-4000-8000-000000000002",
      },
    ],
    recipe_instructions: [
      { id: "step-1", recipe_id: RECIPE_ID, position: 0, title: "Crema", text: "Whisk." },
      { id: "step-2", recipe_id: RECIPE_ID, position: 1, text: "Layer." },
    ],
    recipe_ingredient_ref_link: [
      { instruction_id: "step-1", reference_id: "aaaaaaaa000040008000000000000001" },
      { instruction_id: "step-1", reference_id: "aaaaaaaa000040008000000000000002" },
    ],
    ingredient_foods: [{ id: "food-mascarpone", name: "mascarpone" }],
    ingredient_units: [{ id: "unit-gram", name: "gram" }],
    tags: [],
    recipes_to_tags: [],
    categories: [],
    recipes_to_categories: [],
    tools: [{ id: "tool-1", name: "Stand mixer" }],
    recipes_to_tools: [{ recipe_id: RECIPE_ID, tool_id: "tool-1" }],
    notes: [{ recipe_id: RECIPE_ID, title: "Make ahead", text: "Rest overnight." }],
    users_to_recipes: [
      { id: "u1", recipe_id: RECIPE_ID, user_id: "a", rating: null, is_favorite: false },
      { id: "u2", recipe_id: RECIPE_ID, user_id: "b", rating: null, is_favorite: true },
    ],
    recipe_nutrition: [],
    ...overrides,
  };
}

/** One recipe as the group export and the Download button write it. */
function recipeJson() {
  return {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    name: "Tiramisù",
    tools: [{ id: "tool-1", name: "Stand mixer", slug: "stand-mixer" }],
    notes: [{ title: "Make ahead", text: "Rest overnight." }],
    recipe_ingredient: [
      {
        quantity: 500,
        unit: { id: "unit-gram", name: "gram" },
        food: { id: "food-mascarpone", name: "mascarpone" },
        note: "cold",
        title: "Per la crema",
        original_text: "1 tub mascarpone",
        reference_id: "ref-1",
      },
    ],
    recipe_instructions: [
      {
        id: "step-1",
        title: "",
        text: "Whisk.",
        ingredient_references: [{ reference_id: "ref-1" }],
      },
    ],
  };
}

async function zipBytes(files: Record<string, string>) {
  const zip = new JSZip();

  for (const [name, content] of Object.entries(files)) zip.file(name, content);

  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

async function importFiles(files: Record<string, string>) {
  const result = await importArchive("user-1", ["user-1"], await zipBytes(files));

  return { result, dtos: mockCreateResolvedRecipe.mock.calls.map((call) => call[2]) };
}

describe("Mealie import", () => {
  beforeEach(() => {
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateResolvedRecipe.mockImplementation(async (recipeId: string) => ({
      status: "inserted",
      recipeId,
    }));
    mockSaveImageBytes.mockImplementation(
      async (_b: Buffer, id: string) => `/recipes/${id}/x.webp`
    );
  });

  describe("the admin backup", () => {
    it("builds lines from Mealie's fields and keeps section titles as Headings", async () => {
      const { dtos } = await importFiles({ "database.json": JSON.stringify(backupDatabase()) });

      expect(dtos[0].recipeIngredients).toMatchObject([
        { ingredientName: "# Per la crema", amount: null, order: 0 },
        {
          ingredientName: "mascarpone, cold",
          amount: 500,
          unit: "gram",
          foodTexts: ["mascarpone"],
        },
        // The pre-3.1 text row is read from its text; its quantity of 1 says nothing.
        { ingredientName: "eggs", amount: 3, order: 2 },
      ]);
      expect(dtos[0].recipeIngredients[2].foodTexts).toBeUndefined();
    });

    it("turns step references into Step Ingredients that count the inserted Heading", async () => {
      const { dtos } = await importFiles({ "database.json": JSON.stringify(backupDatabase()) });

      expect(dtos[0].steps).toMatchObject([
        { step: "# Crema", order: 0, stepIngredients: [] },
        {
          step: "Whisk.",
          order: 1,
          stepIngredients: [
            { ingredientOrder: 1, share: 1, order: 0 },
            { ingredientOrder: 2, share: 1, order: 1 },
          ],
        },
        { step: "Layer.", order: 2, stepIngredients: [] },
      ]);
    });

    it("brings the favourite, cuisine, tools, notes and seconds-based times along", async () => {
      const { dtos } = await importFiles({ "database.json": JSON.stringify(backupDatabase()) });

      expect(dtos[0]).toMatchObject({
        cuisines: ["italian-id"],
        tags: [{ name: "Stand mixer" }],
        notes: "Make ahead\nRest overnight.",
        prepMinutes: 30,
        cookMinutes: 10,
        totalMinutes: 45,
      });
      expect(mockAddFavorite).toHaveBeenCalledWith("user-1", dtos[0].id);
    });

    it("drops a cuisine the vocabulary does not know, and says so", async () => {
      const database = backupDatabase();

      database.recipes[0]!.recipeCuisine = "Klingon";

      const { result, dtos } = await importFiles({ "database.json": JSON.stringify(database) });

      expect(dtos[0].cuisines).toEqual([]);
      expect(result.notes).toEqual([
        { file: "recipe_Tiramisù", note: "Unknown cuisines dropped: Klingon" },
      ]);
    });
  });

  describe("the group export", () => {
    it("reads the same detail from a recipe's JSON", async () => {
      const { dtos } = await importFiles({
        "recipes/tiramisu/tiramisu.json": JSON.stringify(recipeJson()),
        "recipes/other/other.json": JSON.stringify({ ...recipeJson(), name: "Other" }),
      });

      expect(dtos[0]).toMatchObject({
        tags: [{ name: "Stand mixer" }],
        notes: "Make ahead\nRest overnight.",
        recipeIngredients: [
          { ingredientName: "# Per la crema" },
          { ingredientName: "mascarpone, cold", amount: 500, foodTexts: ["mascarpone"] },
        ],
        steps: [{ step: "Whisk.", stepIngredients: [{ ingredientOrder: 1, share: 1 }] }],
      });
    });
  });

  describe("a recipe's Download zip", () => {
    it("is recognised with its JSON and image at the zip root", async () => {
      const files = {
        "tiramisu.json": JSON.stringify(recipeJson()),
        "original.webp": "image bytes",
      };

      expect(await getArchiveInfo(await JSZip.loadAsync(await zipBytes(files)))).toEqual({
        format: ArchiveFormat.MEALIE_LEGACY,
        count: 1,
      });

      const { dtos } = await importFiles(files);

      expect(dtos[0]).toMatchObject({
        name: "Tiramisù",
        images: [{ image: `/recipes/${dtos[0].id}/x.webp`, order: 0 }],
      });
    });
  });
});
