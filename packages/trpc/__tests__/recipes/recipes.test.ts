// @vitest-environment node
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recipesRouter } from "../../src/routers/recipes";
import { canAccessResource } from "../mocks/permissions";
import { recipeEmitter } from "../mocks/recipe-emitter";
// Import mocks for assertions
import {
  createRecipeWithRefs,
  dashboardRecipe,
  deleteRecipeById,
  getRecipeFull,
  getRecipeOwnerId,
  getRecipesWithoutCategories,
  listRecipes,
  updateRecipeCategories,
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
    addStepsAndIngredientsToRecipeByInput: vi.fn(),
    createRecipeWithRefs: recipes.createRecipeWithRefs,
    dashboardRecipe: recipes.dashboardRecipe,
    deleteRecipeById: recipes.deleteRecipeById,
    getAllergiesForUsers: vi.fn(),
    getRecipeByUrl: recipes.getRecipeByUrl,
    getRecipeFull: recipes.getRecipeFull,
    getRecipeOwnerId: recipes.getRecipeOwnerId,
    getRecipesByUrlsForPolicy: vi.fn(),
    getRecipesWithoutCategories: recipes.getRecipesWithoutCategories,
    listRecipes: recipes.listRecipes,
    recipeExistsByUrlForPolicy: vi.fn(),
    updateRecipeCategories: recipes.updateRecipeCategories,
    updateRecipeWithRefs: recipes.updateRecipeWithRefs,
  };
});
vi.mock("@norish/db/repositories/recipes", () => import("../mocks/recipes-repository"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/recipes/emitter", () => import("../mocks/recipe-emitter"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

describe("recipes procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
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
                householdUserIds: ctx.householdUserIds,
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
          householdUserIds: ctx.householdUserIds,
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
                householdUserIds: ctx.householdUserIds,
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
          householdUserIds: ctx.householdUserIds,
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
                householdUserIds: ctx.householdUserIds,
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
          householdUserIds: ctx.householdUserIds,
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
                ctx.user.id,
                recipe.userId,
                ctx.householdUserIds,
                ctx.isServerAdmin
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
        ctx.user.id,
        "other-user-id",
        ctx.householdUserIds,
        ctx.isServerAdmin
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
                ctx.user.id,
                recipe.userId,
                ctx.householdUserIds,
                ctx.isServerAdmin
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
                ctx.user.id,
                recipe.userId,
                ctx.householdUserIds,
                ctx.isServerAdmin
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
        multiplexer: null,
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
        ctx.user.id,
        "other-user-id",
        ctx.householdUserIds,
        ctx.isServerAdmin
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

  describe("create", () => {
    it("returns recipe ID and emits created event on success", async () => {
      const mockDashboard = createMockRecipeDashboard({ name: "New Recipe" });

      createRecipeWithRefs.mockResolvedValue("new-recipe-id");
      dashboardRecipe.mockResolvedValue(mockDashboard);

      const testRouter = t.router({
        create: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const recipeId = "test-uuid";

            // Simulate async behavior
            const createdId = await createRecipeWithRefs(recipeId, ctx.user.id, input);

            if (createdId) {
              const dto = await dashboardRecipe(createdId);

              if (dto) {
                recipeEmitter.emitToHousehold(ctx.householdKey, "created", { recipe: dto });
              }
            }

            return recipeId;
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.create({
        name: "New Recipe",
        tags: [],
        recipeIngredients: [],
        steps: [],
      });

      expect(result).toBe("test-uuid");
      expect(createRecipeWithRefs).toHaveBeenCalled();
      expect(recipeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "created", {
        recipe: mockDashboard,
      });
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
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!canEdit) {
                throw new Error("FORBIDDEN");
              }
            }

            await updateRecipeCategories(input.recipeId, input.categories);

            const updated = await getRecipeFull(input.recipeId);

            if (updated) {
              recipeEmitter.emitToHousehold(ctx.householdKey, "updated", { recipe: updated });
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
      expect(recipeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "updated", {
        recipe: expect.objectContaining({ id: "recipe-1" }),
      });
      expect(result).toEqual({ success: true });
    });

    it("returns only recipes without categories", async () => {
      const expected = [
        { id: "recipe-1", name: "No Categories" },
        { id: "recipe-2", name: "Still Empty" },
      ];

      getRecipesWithoutCategories.mockResolvedValue(expected);

      const testRouter = t.router({
        listWithoutCategories: t.procedure
          .input((v: any) => v)
          .query(async () => getRecipesWithoutCategories()),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.listWithoutCategories(undefined);

      expect(getRecipesWithoutCategories).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe("delete", () => {
    it("deletes recipe when user has delete permission", async () => {
      getRecipeOwnerId.mockResolvedValue("test-user-id");
      canAccessResource.mockResolvedValue(true);
      deleteRecipeById.mockResolvedValue(undefined);

      const testRouter = t.router({
        delete: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.id);

            if (ownerId !== null) {
              const canDelete = await canAccessResource(
                "delete",
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!canDelete) {
                throw new Error("FORBIDDEN");
              }
            }

            await deleteRecipeById(input.id);
            recipeEmitter.emitToHousehold(ctx.householdKey, "deleted", { id: input.id });

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.delete({ id: "r1" });

      expect(getRecipeOwnerId).toHaveBeenCalledWith("r1");
      expect(canAccessResource).toHaveBeenCalledWith(
        "delete",
        ctx.user.id,
        "test-user-id",
        ctx.householdUserIds,
        ctx.isServerAdmin
      );
      expect(deleteRecipeById).toHaveBeenCalledWith("r1");
      expect(recipeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "deleted", {
        id: "r1",
      });
      expect(result).toEqual({ success: true });
    });

    it("throws FORBIDDEN when user lacks delete permission", async () => {
      getRecipeOwnerId.mockResolvedValue("other-user-id");
      canAccessResource.mockResolvedValue(false);

      const testRouter = t.router({
        delete: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.id);

            if (ownerId !== null) {
              const canDelete = await canAccessResource(
                "delete",
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!canDelete) {
                throw new Error("FORBIDDEN");
              }
            }

            await deleteRecipeById(input.id);

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.delete({ id: "r1" })).rejects.toThrow("FORBIDDEN");
      expect(deleteRecipeById).not.toHaveBeenCalled();
    });

    it("allows deleting orphaned recipe without permission check", async () => {
      getRecipeOwnerId.mockResolvedValue(null);
      deleteRecipeById.mockResolvedValue(undefined);

      const testRouter = t.router({
        delete: t.procedure
          .input((v: any) => v)
          .mutation(async ({ input }) => {
            const ownerId = await getRecipeOwnerId(input.id);

            if (ownerId !== null) {
              const canDelete = await canAccessResource(
                "delete",
                ctx.user.id,
                ownerId,
                ctx.householdUserIds,
                ctx.isServerAdmin
              );

              if (!canDelete) {
                throw new Error("FORBIDDEN");
              }
            }

            await deleteRecipeById(input.id);
            recipeEmitter.emitToHousehold(ctx.householdKey, "deleted", { id: input.id });

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.delete({ id: "orphan-recipe" });

      expect(canAccessResource).not.toHaveBeenCalled();
      expect(deleteRecipeById).toHaveBeenCalledWith("orphan-recipe");
      expect(result).toEqual({ success: true });
    });
  });
});
