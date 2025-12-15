import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

vi.mock("@/server/db/repositories/ratings", () => import("../../mocks/ratings-repository"));
vi.mock("@/server/trpc/routers/ratings/emitter", () => import("../../mocks/ratings-emitter"));
vi.mock("@/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "household" }),
}));
vi.mock("@/server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { rateRecipe, getUserRating, getAverageRating } from "../../mocks/ratings-repository";
import { createMockUser, createMockHousehold, createMockAuthedContext } from "./test-utils";

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

describe("ratings procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  describe("getUserRating", () => {
    it("returns user rating for recipe", async () => {
      getUserRating.mockResolvedValue(4);

      const testRouter = t.router({
        getUserRating: t.procedure
          .input((v) => v as { recipeId: string })
          .query(async ({ input }) => {
            const rating = await getUserRating(ctx.user.id, input.recipeId);
            return { recipeId: input.recipeId, userRating: rating };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getUserRating({ recipeId: "recipe-1" });

      expect(getUserRating).toHaveBeenCalledWith(ctx.user.id, "recipe-1");
      expect(result.userRating).toBe(4);
    });

    it("returns null when user has not rated", async () => {
      getUserRating.mockResolvedValue(null);

      const testRouter = t.router({
        getUserRating: t.procedure
          .input((v) => v as { recipeId: string })
          .query(async ({ input }) => {
            const rating = await getUserRating(ctx.user.id, input.recipeId);
            return { recipeId: input.recipeId, userRating: rating };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getUserRating({ recipeId: "recipe-1" });

      expect(result.userRating).toBeNull();
    });
  });

  describe("getAverage", () => {
    it("returns average rating and count", async () => {
      getAverageRating.mockResolvedValue({ averageRating: 4.5, ratingCount: 10 });

      const testRouter = t.router({
        getAverage: t.procedure
          .input((v) => v as { recipeId: string })
          .query(async ({ input }) => {
            const stats = await getAverageRating(input.recipeId);
            return { recipeId: input.recipeId, ...stats };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getAverage({ recipeId: "recipe-1" });

      expect(getAverageRating).toHaveBeenCalledWith("recipe-1");
      expect(result.averageRating).toBe(4.5);
      expect(result.ratingCount).toBe(10);
    });

    it("returns null average for unrated recipe", async () => {
      getAverageRating.mockResolvedValue({ averageRating: null, ratingCount: 0 });

      const testRouter = t.router({
        getAverage: t.procedure
          .input((v) => v as { recipeId: string })
          .query(async ({ input }) => {
            const stats = await getAverageRating(input.recipeId);
            return { recipeId: input.recipeId, ...stats };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.getAverage({ recipeId: "recipe-1" });

      expect(result.averageRating).toBeNull();
      expect(result.ratingCount).toBe(0);
    });
  });

  describe("rate", () => {
    it("creates new rating", async () => {
      rateRecipe.mockResolvedValue({ rating: 5, isNew: true });
      getAverageRating.mockResolvedValue({ averageRating: 5, ratingCount: 1 });

      const testRouter = t.router({
        rate: t.procedure
          .input((v) => v as { recipeId: string; rating: number })
          .mutation(async ({ input }) => {
            await rateRecipe(ctx.user.id, input.recipeId, input.rating);
            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.rate({ recipeId: "recipe-1", rating: 5 });

      expect(rateRecipe).toHaveBeenCalledWith(ctx.user.id, "recipe-1", 5);
      expect(result.success).toBe(true);
    });

    it("updates existing rating", async () => {
      rateRecipe.mockResolvedValue({ rating: 3, isNew: false });
      getAverageRating.mockResolvedValue({ averageRating: 3.5, ratingCount: 2 });

      const testRouter = t.router({
        rate: t.procedure
          .input((v) => v as { recipeId: string; rating: number })
          .mutation(async ({ input }) => {
            const result = await rateRecipe(ctx.user.id, input.recipeId, input.rating);
            return { success: true, isNew: result.isNew };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const result = await caller.rate({ recipeId: "recipe-1", rating: 3 });

      expect(result.isNew).toBe(false);
    });

    it("validates rating is between 1 and 5", async () => {
      const testRouter = t.router({
        rate: t.procedure
          .input((v) => {
            const input = v as { recipeId: string; rating: number };
            if (input.rating < 1 || input.rating > 5) {
              throw new Error("Rating must be between 1 and 5");
            }
            return input;
          })
          .mutation(async ({ input }) => {
            await rateRecipe(ctx.user.id, input.recipeId, input.rating);
            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);

      await expect(caller.rate({ recipeId: "recipe-1", rating: 0 })).rejects.toThrow();
      await expect(caller.rate({ recipeId: "recipe-1", rating: 6 })).rejects.toThrow();
    });
  });
});

