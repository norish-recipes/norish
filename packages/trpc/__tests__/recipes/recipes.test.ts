// @vitest-environment node
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recipesRouter } from "../../src/routers/recipes";
import { updateRecipeProcedure } from "../../src/routers/recipes/recipes";
import { router } from "../../src/trpc";
import { canAccessResource } from "../mocks/permissions";
import { recipes } from "../mocks/realtime/recipes";
// Import mocks for assertions
import {
  createRecipeWithRefs,
  dashboardRecipe,
  deleteRecipeById,
  getRecipeFull,
  getRecipeOwnerId,
  listRecipes,
  updateRecipeCategories,
  updateRecipeWithRefs,
} from "../mocks/recipes-repository";
// Import test utilities
import {
  createMockAuthedContext,
  createMockFullRecipe,
  createMockHousehold,
  createMockRecipeDashboard,
  createMockUser,
} from "./test-utils";

// Setup mocks before any imports that use them
vi.mock("@norish/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/db")>();
  const recipes = await import("../mocks/recipes-repository");

  return {
    ...actual,
    writeConvertedCopy: vi.fn(),
    createRecipeWithRefs: recipes.createRecipeWithRefs,
    dashboardRecipe: recipes.dashboardRecipe,
    deleteRecipeById: recipes.deleteRecipeById,
    getAllergiesForUsers: vi.fn(),
    getRecipeByUrl: recipes.getRecipeByUrl,
    getRecipeFull: recipes.getRecipeFull,
    getRecipeOwnerId: recipes.getRecipeOwnerId,
    getRecipesByUrlsForPolicy: vi.fn(),
    listRecipes: recipes.listRecipes,
    recipeExistsByUrlForPolicy: vi.fn(),
    updateRecipeCategories: recipes.updateRecipeCategories,
    updateRecipeWithRefs: recipes.updateRecipeWithRefs,
  };
});
vi.mock("@norish/db/repositories/recipes", () => import("../mocks/recipes-repository"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/recipes", () => import("../mocks/realtime/recipes"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));

const readRecipeNutrition = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared-server/ingredients/nutrition/recipe-nutrition", () => ({
  readRecipeNutrition,
}));

// The Dish Colour helpers are pinned by their own suite
// (shared-server __tests__/media/dish-color.test.ts); here they return a
// sentinel so the tests can prove the router threads them into the writes.
// The literal is repeated inside the factory because vi.mock hoists above
// any file-body binding.
const EXTRACTED_DISH_COLOR = "#a1b2c3";

vi.mock("@norish/shared-server/media/dish-color", () => ({
  withDishColor: vi.fn(async (dto: Record<string, unknown>) => ({
    ...dto,
    dishColor: "#a1b2c3",
  })),
  withDishColorForUpdate: vi.fn(async (data: Record<string, unknown>) =>
    data.image !== undefined || data.images !== undefined ? { ...data, dishColor: "#a1b2c3" } : data
  ),
}));

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

describe("recipes procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  function createValidFullRecipe(overrides: Parameters<typeof createMockFullRecipe>[0] = {}) {
    return createMockFullRecipe({
      notes: "",
      version: 1,
      tags: [{ name: "dinner", version: 1 }],
      recipeIngredients: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          ingredientId: "55555555-5555-4555-8555-555555555555",
          ingredientName: "Flour",
          amount: 200,
          unit: "g",
          systemUsed: "metric",
          order: 0,
          version: 1,
        },
      ],
      steps: [
        {
          step: "Mix all ingredients",
          systemUsed: "metric",
          order: 0,
          images: [],
          stepIngredients: [],
          version: 1,
        },
      ],
      author: { id: "test-user-id", name: "Test User", image: null, version: 1 },
      ...overrides,
    });
  }

  describe("list", () => {
    it("returns paginated recipes with filters", async () => {
      const mockRecipes = [
        createMockRecipeDashboard({ id: "r1", name: "Recipe 1" }),
        createMockRecipeDashboard({ id: "r2", name: "Recipe 2" }),
      ];

      listRecipes.mockResolvedValue({
        recipes: mockRecipes,
        total: 2,
      });

      // Create test caller
      const testRouter = t.router({
        list: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const result = await listRecipes(
              {
                userId: ctx.user.id,
                householdId: ctx.householdId,
                isServerAdmin: ctx.isServerAdmin,
              },
              input.limit,
              input.cursor,
              input.search,
              input.searchFields,
              input.tags,
              input.filterMode,
              input.sortMode,
              input.minRating,
              input.maxCookingTime,
              input.categories
            );

            return {
              recipes: result.recipes,
              total: result.total,
              nextCursor:
                input.cursor + input.limit < result.total ? input.cursor + input.limit : null,
            };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.list({
        cursor: 0,
        limit: 50,
        filterMode: "OR",
        sortMode: "dateDesc",
        categories: ["Breakfast", "Dinner"],
        searchFields: ["title", "ingredients"],
      });

      expect(listRecipes).toHaveBeenCalledWith(
        {
          userId: ctx.user.id,
          householdId: ctx.householdId,
          isServerAdmin: ctx.isServerAdmin,
        },
        50,
        0,
        undefined,
        ["title", "ingredients"],
        undefined,
        "OR",
        "dateDesc",
        undefined,
        undefined,
        ["Breakfast", "Dinner"]
      );
      expect(result.recipes).toEqual(mockRecipes);
      expect(result.total).toBe(2);
      expect(result.nextCursor).toBeNull();
    });

    it("returns nextCursor when more pages available", async () => {
      const mockRecipes = Array.from({ length: 50 }, (_, i) =>
        createMockRecipeDashboard({ id: `r${i}`, name: `Recipe ${i}` })
      );

      listRecipes.mockResolvedValue({
        recipes: mockRecipes,
        total: 100,
      });

      const testRouter = t.router({
        list: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const result = await listRecipes(
              {
                userId: ctx.user.id,
                householdId: ctx.householdId,
                isServerAdmin: ctx.isServerAdmin,
              },
              input.limit,
              input.cursor,
              input.search,
              input.searchFields,
              input.tags,
              input.filterMode,
              input.sortMode,
              input.minRating,
              input.maxCookingTime,
              input.categories
            );

            return {
              recipes: result.recipes,
              total: result.total,
              nextCursor:
                input.cursor + input.limit < result.total ? input.cursor + input.limit : null,
            };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.list({ cursor: 0, limit: 50 });

      expect(listRecipes).toHaveBeenCalledWith(
        {
          userId: ctx.user.id,
          householdId: ctx.householdId,
          isServerAdmin: ctx.isServerAdmin,
        },
        50,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(result.nextCursor).toBe(50);
    });

    it("filters recipes by categories", async () => {
      const mockRecipes = [
        createMockRecipeDashboard({ id: "r1", categories: ["Breakfast"] }),
        createMockRecipeDashboard({ id: "r2", categories: ["Dinner"] }),
      ];

      listRecipes.mockResolvedValue({
        recipes: mockRecipes,
        total: 2,
      });

      const testRouter = t.router({
        list: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const result = await listRecipes(
              {
                userId: ctx.user.id,
                householdId: ctx.householdId,
                isServerAdmin: ctx.isServerAdmin,
              },
              input.limit,
              input.cursor,
              input.search,
              input.searchFields,
              input.tags,
              input.filterMode,
              input.sortMode,
              input.minRating,
              input.maxCookingTime,
              input.categories
            );

            return result;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.list({
        cursor: 0,
        limit: 50,
        categories: ["Breakfast", "Dinner"],
      });

      expect(listRecipes).toHaveBeenCalledWith(
        {
          userId: ctx.user.id,
          householdId: ctx.householdId,
          isServerAdmin: ctx.isServerAdmin,
        },
        50,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ["Breakfast", "Dinner"]
      );
      expect(result.recipes).toEqual(mockRecipes);
      expect(result.total).toBe(2);
    });
  });

  describe("get", () => {
    it("returns recipe when user has view permission", async () => {
      const mockRecipe = createMockFullRecipe({ id: "r1", userId: "other-user-id" });

      getRecipeFull.mockResolvedValue(mockRecipe);
      canAccessResource.mockResolvedValue(true);

      const testRouter = t.router({
        get: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const recipe = await getRecipeFull(input.id);

            if (!recipe) {
              throw new Error("Recipe not found");
            }

            if (recipe.userId) {
              const canView = await canAccessResource(
                "view",
                {
                  userId: ctx.user.id,
                  householdId: ctx.householdId,
                  isServerAdmin: ctx.isServerAdmin,
                },
                recipe.userId
              );

              if (!canView) {
                throw new Error("Recipe not found");
              }
            }

            return recipe;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.get({ id: "r1" });

      expect(getRecipeFull).toHaveBeenCalledWith("r1");
      expect(canAccessResource).toHaveBeenCalledWith(
        "view",
        { userId: ctx.user.id, householdId: ctx.householdId, isServerAdmin: ctx.isServerAdmin },
        "other-user-id"
      );
      expect(result).toEqual(mockRecipe);
    });

    it("throws when user lacks view permission", async () => {
      const mockRecipe = createMockFullRecipe({ id: "r1", userId: "other-user-id" });

      getRecipeFull.mockResolvedValue(mockRecipe);
      canAccessResource.mockResolvedValue(false);

      const testRouter = t.router({
        get: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const recipe = await getRecipeFull(input.id);

            if (!recipe) {
              throw new Error("Recipe not found");
            }

            if (recipe.userId) {
              const canView = await canAccessResource(
                "view",
                {
                  userId: ctx.user.id,
                  householdId: ctx.householdId,
                  isServerAdmin: ctx.isServerAdmin,
                },
                recipe.userId
              );

              if (!canView) {
                throw new Error("Recipe not found");
              }
            }

            return recipe;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      await expect(caller.get({ id: "r1" })).rejects.toThrow("Recipe not found");
    });

    it("returns orphaned recipe without permission check", async () => {
      const mockRecipe = createMockFullRecipe({ id: "r1", userId: null });

      getRecipeFull.mockResolvedValue(mockRecipe);

      const testRouter = t.router({
        get: t.procedure
          .input((v: any) => v)
          .query(async ({ input }) => {
            const recipe = await getRecipeFull(input.id);

            if (!recipe) {
              throw new Error("Recipe not found");
            }

            if (recipe.userId) {
              const canView = await canAccessResource(
                "view",
                {
                  userId: ctx.user.id,
                  householdId: ctx.householdId,
                  isServerAdmin: ctx.isServerAdmin,
                },
                recipe.userId
              );

              if (!canView) {
                throw new Error("Recipe not found");
              }
            }

            return recipe;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.get({ id: "r1" });

      expect(canAccessResource).not.toHaveBeenCalled();
      expect(result).toEqual(mockRecipe);
    });
  });

  describe("getEditable", () => {
    const editableRecipeId = "11111111-1111-4111-8111-111111111111";
    const missingRecipeId = "22222222-2222-4222-8222-222222222222";
    const orphanRecipeId = "33333333-3333-4333-8333-333333333333";

    function createCaller() {
      return recipesRouter.createCaller({
        ...ctx,
        connectionId: null,
        operationId: null,
      });
    }

    it("returns recipe when user has edit permission", async () => {
      const mockRecipe = createValidFullRecipe({ id: editableRecipeId, userId: "other-user-id" });

      getRecipeFull.mockResolvedValue(mockRecipe);
      getRecipeOwnerId.mockResolvedValue("other-user-id");
      canAccessResource.mockResolvedValue(true);

      const result = await createCaller().getEditable({ id: editableRecipeId });

      expect(getRecipeFull).toHaveBeenCalledWith(editableRecipeId);
      expect(getRecipeOwnerId).toHaveBeenCalledWith(editableRecipeId);
      expect(canAccessResource).toHaveBeenCalledWith(
        "edit",
        { userId: ctx.user.id, householdId: ctx.householdId, isServerAdmin: ctx.isServerAdmin },
        "other-user-id"
      );
      expect(result).toEqual(mockRecipe);
    });

    it("throws FORBIDDEN when user lacks edit permission", async () => {
      const mockRecipe = createValidFullRecipe({ id: editableRecipeId, userId: "other-user-id" });

      getRecipeFull.mockResolvedValue(mockRecipe);
      getRecipeOwnerId.mockResolvedValue("other-user-id");
      canAccessResource.mockResolvedValue(false);

      await expect(createCaller().getEditable({ id: editableRecipeId })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("throws NOT_FOUND when recipe does not exist", async () => {
      getRecipeFull.mockResolvedValue(null);

      await expect(createCaller().getEditable({ id: missingRecipeId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(getRecipeOwnerId).not.toHaveBeenCalled();
    });

    it("returns orphaned recipe without permission check", async () => {
      const mockRecipe = createValidFullRecipe({ id: orphanRecipeId, userId: null });

      getRecipeFull.mockResolvedValue(mockRecipe);
      getRecipeOwnerId.mockResolvedValue(null);

      const result = await createCaller().getEditable({ id: orphanRecipeId });

      expect(canAccessResource).not.toHaveBeenCalled();
      expect(result).toEqual(mockRecipe);
    });
  });

  describe("nutrition", () => {
    const recipeId = "88888888-8888-4888-8888-888888888888";
    const answer = {
      source: "supplied",
      perServing: { calories: 320, fat: 10, carbs: 40, protein: 12, extras: {} },
      estimated: false,
      leftOut: [],
      credits: [],
      extrasCoverage: {},
    };
    const caller = () =>
      recipesRouter.createCaller({ ...ctx, connectionId: null, operationId: null });

    it("answers the recipe's nutrition for the reader's household", async () => {
      const recipe = createValidFullRecipe({ id: recipeId, userId: "other-user-id" });

      getRecipeFull.mockResolvedValue(recipe);
      canAccessResource.mockResolvedValue(true);
      readRecipeNutrition.mockResolvedValue(answer);

      await expect(caller().nutrition({ id: recipeId })).resolves.toEqual(answer);
      expect(readRecipeNutrition).toHaveBeenCalledWith(recipe, { householdId: ctx.householdId });
    });

    it("is NOT_FOUND for a recipe that is missing or the reader may not view", async () => {
      getRecipeFull.mockResolvedValue(null);
      await expect(caller().nutrition({ id: recipeId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      getRecipeFull.mockResolvedValue(createValidFullRecipe({ id: recipeId, userId: "other" }));
      canAccessResource.mockResolvedValue(false);
      await expect(caller().nutrition({ id: recipeId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("create", () => {
    const recipeId = "77777777-7777-4777-8777-777777777777";
    const input = {
      id: recipeId,
      name: "New Recipe",
      tags: [],
      recipeIngredients: [],
      steps: [],
      systemUsed: "metric" as const,
    };

    function createCaller() {
      return recipesRouter.createCaller({ ...ctx, connectionId: null, operationId: null });
    }

    // The announcement runs after the answer: let it settle before asserting on it.
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    it("answers the id once stored and announces the recipe", async () => {
      const mockDashboard = createMockRecipeDashboard({ id: recipeId, name: "New Recipe" });

      createRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId });
      dashboardRecipe.mockResolvedValue(mockDashboard);

      expect(await createCaller().create(input)).toBe(recipeId);
      await settle();
      expect(recipes.publish).toHaveBeenCalledWith(
        "created",
        { recipe: mockDashboard },
        expect.anything()
      );
    });

    it("answers a replayed create whose id is already stored", async () => {
      createRecipeWithRefs.mockResolvedValue({ status: "existing", recipeId });
      dashboardRecipe.mockResolvedValue(null);

      expect(await createCaller().create(input)).toBe(recipeId);
    });

    it("only logs a failure after the recipe is stored", async () => {
      createRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId });
      dashboardRecipe.mockRejectedValue(new Error("Valkey down"));

      expect(await createCaller().create(input)).toBe(recipeId);
      await settle();
      expect(recipes.publish).not.toHaveBeenCalledWith(
        "failed",
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("categories", () => {
    it("updates recipe categories and emits updated event", async () => {
      updateRecipeCategories.mockResolvedValue(undefined);
      getRecipeFull.mockResolvedValue(createMockFullRecipe({ id: "recipe-1" }));
      getRecipeOwnerId.mockResolvedValue("test-user-id");
      canAccessResource.mockResolvedValue(true);

      const testRouter = t.router({
        updateCategories: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.recipeId);

            if (ownerId !== null) {
              const canEdit = await canAccessResource(
                "edit",
                {
                  userId: ctx.user.id,
                  householdId: ctx.householdId,
                  isServerAdmin: ctx.isServerAdmin,
                },
                ownerId
              );

              if (!canEdit) {
                throw new Error("FORBIDDEN");
              }
            }

            await updateRecipeCategories(input.recipeId, input.categories);

            const updated = await getRecipeFull(input.recipeId);

            if (updated) {
              void recipes.publish(
                "updated",
                { recipe: updated },
                { householdId: ctx.householdId }
              );
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.updateCategories({
        recipeId: "recipe-1",
        categories: ["Dinner", "Snack"],
      });

      expect(updateRecipeCategories).toHaveBeenCalledWith("recipe-1", ["Dinner", "Snack"]);
      expect(recipes.publish).toHaveBeenCalledWith(
        "updated",
        {
          recipe: expect.objectContaining({ id: "recipe-1" }),
        },
        { householdId: ctx.householdId }
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe("edit via the API", () => {
    const recipeId = "66666666-6666-4666-8666-666666666666";

    function createCaller() {
      return router({ updateRecipe: updateRecipeProcedure }).createCaller({
        ...ctx,
        connectionId: null,
        operationId: null,
      });
    }

    it("waits for the edit and returns the stored recipe", async () => {
      const edited = createValidFullRecipe({ id: recipeId, name: "Renamed", version: 2 });

      getRecipeFull.mockResolvedValue(edited);
      getRecipeOwnerId.mockResolvedValue(ctx.user.id);
      canAccessResource.mockResolvedValue(true);
      updateRecipeWithRefs.mockResolvedValue({ stale: false });

      const result = await createCaller().updateRecipe({
        id: recipeId,
        data: { name: "Renamed" },
        version: 1,
      });

      expect(updateRecipeWithRefs).toHaveBeenCalledWith(
        recipeId,
        ctx.user.id,
        expect.objectContaining({ name: "Renamed" }),
        1
      );
      expect(result).toEqual({ recipe: edited, stale: false });
      expect(recipes.publish).toHaveBeenCalledWith(
        "updated",
        { recipe: edited },
        expect.anything()
      );
    });

    it("reports a stale version without publishing", async () => {
      getRecipeFull.mockResolvedValue(createValidFullRecipe({ id: recipeId }));
      getRecipeOwnerId.mockResolvedValue(ctx.user.id);
      canAccessResource.mockResolvedValue(true);
      updateRecipeWithRefs.mockResolvedValue({ stale: true });

      const result = await createCaller().updateRecipe({
        id: recipeId,
        data: { name: "Renamed" },
        version: 1,
      });

      expect(result).toEqual({ recipe: null, stale: true });
      expect(recipes.publish).not.toHaveBeenCalledWith(
        "updated",
        expect.anything(),
        expect.anything()
      );
    });

    it("throws NOT_FOUND for a recipe that does not exist", async () => {
      getRecipeFull.mockResolvedValue(null);

      await expect(
        createCaller().updateRecipe({ id: recipeId, data: { name: "x" }, version: 1 })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(updateRecipeWithRefs).not.toHaveBeenCalled();
    });

    it("throws FORBIDDEN when the caller may view but not edit", async () => {
      getRecipeFull.mockResolvedValue(
        createValidFullRecipe({ id: recipeId, userId: "other-user-id" })
      );
      getRecipeOwnerId.mockResolvedValue("other-user-id");
      canAccessResource.mockImplementation(async (action: string) => action === "view");

      await expect(
        createCaller().updateRecipe({ id: recipeId, data: { name: "x" }, version: 1 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(updateRecipeWithRefs).not.toHaveBeenCalled();
    });
  });

  describe("edit from the app", () => {
    const id = "55555555-5555-4555-8555-555555555555";

    function createCaller() {
      return recipesRouter.createCaller({ ...ctx, connectionId: null, operationId: null });
    }

    it("rejects a refused edit, so the client rolls back and Replay parks it", async () => {
      getRecipeOwnerId.mockResolvedValue("other-user-id");
      canAccessResource.mockResolvedValue(false);

      await expect(
        createCaller().update({ id, data: { name: "x" }, version: 1 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(recipes.publish).not.toHaveBeenCalledWith(
        "failed",
        expect.anything(),
        expect.anything()
      );
    });

    it("rejects an edit the database failed to store", async () => {
      getRecipeOwnerId.mockResolvedValue(ctx.user.id);
      canAccessResource.mockResolvedValue(true);
      updateRecipeWithRefs.mockRejectedValue(new Error("connection lost"));

      await expect(
        createCaller().update({ id, data: { name: "x" }, version: 1 })
      ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    });

    it("answers a stored edit as stored when reading it back fails", async () => {
      getRecipeOwnerId.mockResolvedValue(ctx.user.id);
      canAccessResource.mockResolvedValue(true);
      updateRecipeWithRefs.mockResolvedValue({ stale: false, value: 2 });
      getRecipeFull.mockRejectedValue(new Error("read failed"));

      await expect(createCaller().update({ id, data: { name: "x" }, version: 1 })).resolves.toEqual(
        { stale: false, version: 2 }
      );
    });
  });

  describe("Dish Colour store paths", () => {
    const recipeImage = "/recipes/44444444-4444-4444-8444-444444444444/photo.jpg";

    function createCaller() {
      return recipesRouter.createCaller({
        ...ctx,
        connectionId: null,
        operationId: null,
      });
    }

    it("a create carrying an image stores the extracted Dish Colour (upload path)", async () => {
      createRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "new-id" });
      dashboardRecipe.mockResolvedValue(null);

      await createCaller().create({ name: "Uploaded", images: [{ image: recipeImage, order: 0 }] });

      await vi.waitFor(() => expect(createRecipeWithRefs).toHaveBeenCalled());
      expect(createRecipeWithRefs).toHaveBeenCalledWith(
        expect.any(String),
        ctx.user.id,
        expect.objectContaining({
          images: [{ image: recipeImage, order: 0 }],
          dishColor: EXTRACTED_DISH_COLOR,
        })
      );
    });

    it("an edit replacing the image recomputes the Dish Colour", async () => {
      getRecipeOwnerId.mockResolvedValue(ctx.user.id);
      canAccessResource.mockResolvedValue(true);
      updateRecipeWithRefs.mockResolvedValue({ stale: false });
      getRecipeFull.mockResolvedValue(null);

      await createCaller().update({
        id: "55555555-5555-4555-8555-555555555555",
        data: { images: [{ image: recipeImage, order: 0 }] },
        version: 1,
      });

      await vi.waitFor(() => expect(updateRecipeWithRefs).toHaveBeenCalled());
      expect(updateRecipeWithRefs).toHaveBeenCalledWith(
        "55555555-5555-4555-8555-555555555555",
        ctx.user.id,
        expect.objectContaining({
          images: [{ image: recipeImage, order: 0 }],
          dishColor: EXTRACTED_DISH_COLOR,
        }),
        1
      );
    });

    it("answers an edit once it is stored, so the next queued edit finds its version", async () => {
      const stored = Promise.withResolvers<{ stale: false }>();
      let answered = false;

      getRecipeOwnerId.mockResolvedValue(ctx.user.id);
      canAccessResource.mockResolvedValue(true);
      updateRecipeWithRefs.mockReturnValue(stored.promise);
      getRecipeFull.mockResolvedValue(null);

      const answer = createCaller()
        .update({ id: "55555555-5555-4555-8555-555555555555", data: { name: "x" }, version: 1 })
        .then(() => (answered = true));

      await vi.waitFor(() => expect(updateRecipeWithRefs).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(answered).toBe(false);
      stored.resolve({ stale: false });
      await answer;
    });

    it("answers with the version it stored, or that it refused a stale one", async () => {
      const id = "55555555-5555-4555-8555-555555555555";

      getRecipeOwnerId.mockResolvedValue(ctx.user.id);
      canAccessResource.mockResolvedValue(true);
      getRecipeFull.mockResolvedValue(null);
      updateRecipeWithRefs.mockResolvedValueOnce({ stale: false, value: 6 });
      updateRecipeWithRefs.mockResolvedValueOnce({ stale: true });

      await expect(createCaller().update({ id, data: { name: "x" }, version: 5 })).resolves.toEqual(
        { stale: false, version: 6 }
      );
      await expect(createCaller().update({ id, data: { name: "x" }, version: 5 })).resolves.toEqual(
        { stale: true, version: null }
      );
    });

    it("an edit that does not touch the media says nothing about the colour", async () => {
      getRecipeOwnerId.mockResolvedValue(ctx.user.id);
      canAccessResource.mockResolvedValue(true);
      updateRecipeWithRefs.mockResolvedValue({ stale: false });
      getRecipeFull.mockResolvedValue(null);

      await createCaller().update({
        id: "55555555-5555-4555-8555-555555555555",
        data: { name: "Renamed only" },
        version: 1,
      });

      await vi.waitFor(() => expect(updateRecipeWithRefs).toHaveBeenCalled());
      const payload = updateRecipeWithRefs.mock.calls[0]?.[2] as Record<string, unknown>;

      expect("dishColor" in payload).toBe(false);
    });
  });
});
