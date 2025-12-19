import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

vi.mock("@/server/db/repositories/favorites", () => import("../../mocks/favorites-repository"));
vi.mock("@/server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  toggleFavorite,
  isFavorite,
  getFavoriteRecipeIds,
  getFavoritesByRecipeIds,
} from "../../mocks/favorites-repository";

import { createMockUser, createMockHousehold, createMockAuthedContext } from "./test-utils";

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

describe("favorites procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  describe("toggle", () => {
    it("toggles favorite on (adds to favorites)", async () => {
      toggleFavorite.mockResolvedValue({ isFavorite: true });

      const testRouter = t.router({
        toggle: t.procedure
          .input((v) => v as { recipeId: string })
          .mutation(async ({ input }) => {
            const result = await toggleFavorite(ctx.user.id, input.recipeId);

            return { recipeId: input.recipeId, isFavorite: result.isFavorite };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.toggle({ recipeId: "recipe-1" });

      expect(toggleFavorite).toHaveBeenCalledWith(ctx.user.id, "recipe-1");
      expect(result.isFavorite).toBe(true);
    });

    it("toggles favorite off (removes from favorites)", async () => {
      toggleFavorite.mockResolvedValue({ isFavorite: false });

      const testRouter = t.router({
        toggle: t.procedure
          .input((v) => v as { recipeId: string })
          .mutation(async ({ input }) => {
            const result = await toggleFavorite(ctx.user.id, input.recipeId);

            return { recipeId: input.recipeId, isFavorite: result.isFavorite };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.toggle({ recipeId: "recipe-1" });

      expect(result.isFavorite).toBe(false);
    });
  });

  describe("check", () => {
    it("returns true for favorited recipe", async () => {
      isFavorite.mockResolvedValue(true);

      const testRouter = t.router({
        check: t.procedure
          .input((v) => v as { recipeId: string })
          .query(async ({ input }) => {
            const result = await isFavorite(ctx.user.id, input.recipeId);

            return { recipeId: input.recipeId, isFavorite: result };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.check({ recipeId: "recipe-1" });

      expect(isFavorite).toHaveBeenCalledWith(ctx.user.id, "recipe-1");
      expect(result.isFavorite).toBe(true);
    });

    it("returns false for non-favorited recipe", async () => {
      isFavorite.mockResolvedValue(false);

      const testRouter = t.router({
        check: t.procedure
          .input((v) => v as { recipeId: string })
          .query(async ({ input }) => {
            const result = await isFavorite(ctx.user.id, input.recipeId);

            return { recipeId: input.recipeId, isFavorite: result };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.check({ recipeId: "recipe-1" });

      expect(result.isFavorite).toBe(false);
    });
  });

  describe("list", () => {
    it("returns all favorite recipe IDs for user", async () => {
      const mockIds = ["recipe-1", "recipe-2", "recipe-3"];

      getFavoriteRecipeIds.mockResolvedValue(mockIds);

      const testRouter = t.router({
        list: t.procedure.query(async () => {
          const favoriteIds = await getFavoriteRecipeIds(ctx.user.id);

          return { favoriteIds };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.list();

      expect(getFavoriteRecipeIds).toHaveBeenCalledWith(ctx.user.id);
      expect(result.favoriteIds).toEqual(mockIds);
    });

    it("returns empty array when no favorites", async () => {
      getFavoriteRecipeIds.mockResolvedValue([]);

      const testRouter = t.router({
        list: t.procedure.query(async () => {
          const favoriteIds = await getFavoriteRecipeIds(ctx.user.id);

          return { favoriteIds };
        }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.list();

      expect(result.favoriteIds).toEqual([]);
    });
  });

  describe("batchCheck", () => {
    it("returns favorited IDs from batch", async () => {
      const favoritesSet = new Set(["recipe-1", "recipe-3"]);

      getFavoritesByRecipeIds.mockResolvedValue(favoritesSet);

      const testRouter = t.router({
        batchCheck: t.procedure
          .input((v) => v as { recipeIds: string[] })
          .query(async ({ input }) => {
            const favorites = await getFavoritesByRecipeIds(ctx.user.id, input.recipeIds);

            return { favoriteIds: Array.from(favorites) };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.batchCheck({
        recipeIds: ["recipe-1", "recipe-2", "recipe-3"],
      });

      expect(getFavoritesByRecipeIds).toHaveBeenCalledWith(ctx.user.id, [
        "recipe-1",
        "recipe-2",
        "recipe-3",
      ]);
      expect(result.favoriteIds).toEqual(["recipe-1", "recipe-3"]);
    });

    it("returns empty array when no recipes are favorited", async () => {
      getFavoritesByRecipeIds.mockResolvedValue(new Set());

      const testRouter = t.router({
        batchCheck: t.procedure
          .input((v) => v as { recipeIds: string[] })
          .query(async ({ input }) => {
            const favorites = await getFavoritesByRecipeIds(ctx.user.id, input.recipeIds);

            return { favoriteIds: Array.from(favorites) };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.batchCheck({ recipeIds: ["recipe-1", "recipe-2"] });

      expect(result.favoriteIds).toEqual([]);
    });
  });
});
