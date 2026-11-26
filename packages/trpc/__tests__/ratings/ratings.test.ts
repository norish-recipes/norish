// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";
import { ratingsProcedures } from "@norish/trpc/routers/ratings/ratings";

import { policy, resetPermissionsMocks } from "../mocks/permissions";
import {
  getAverageRating,
  getUserRatingWithVersion,
  rateRecipe,
} from "../mocks/ratings-repository";
import { ratings } from "../mocks/realtime/ratings";
import { everyRecipeIn, resetRecipesMocks } from "../mocks/recipes-repository";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

vi.mock("@norish/db/repositories/ratings", () => import("../mocks/ratings-repository"));
vi.mock("@norish/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db")>()),
  getRecipeHouseholdIds: (await import("../mocks/recipes-repository")).getRecipeHouseholdIds,
}));
vi.mock("@norish/db/repositories/recipes", () => import("../mocks/recipes-repository"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/ratings", () => import("../mocks/realtime/ratings"));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "household" }),
}));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("ratings procedures", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    resetPermissionsMocks();
    resetRecipesMocks();
    everyRecipeIn("another-household");
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  const caller = () => ratingsProcedures.createCaller(ctx as never);

  it("answers the account's own rating and version of a recipe it may view", async () => {
    const recipeId = crypto.randomUUID();

    getUserRatingWithVersion.mockResolvedValue({ rating: 4, version: 2 });

    await expect(caller().getUserRating({ recipeId })).resolves.toEqual({
      recipeId,
      userRating: 4,
      version: 2,
    });
    expect(getUserRatingWithVersion).toHaveBeenCalledWith(ctx.user.id, recipeId);
  });

  it("answers a recipe's average and how many rated it", async () => {
    const recipeId = crypto.randomUUID();

    getAverageRating.mockResolvedValue({ averageRating: 4.5, ratingCount: 10 });

    await expect(caller().getAverage({ recipeId })).resolves.toEqual({
      recipeId,
      averageRating: 4.5,
      ratingCount: 10,
    });
  });

  describe("a recipe out of view", () => {
    beforeEach(() => {
      policy.view = "household";
    });

    it("is never rated, and answers as a gone one", async () => {
      const caller = ratingsProcedures.createCaller(ctx as never);
      const recipeId = crypto.randomUUID();

      await expect(caller.rate({ recipeId, rating: 4 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(rateRecipe).not.toHaveBeenCalled();
    });

    it("reads as never rated, its own rating kept", async () => {
      const caller = ratingsProcedures.createCaller(ctx as never);
      const recipeId = crypto.randomUUID();

      getAverageRating.mockClear();
      await expect(caller.getUserRating({ recipeId })).resolves.toEqual({
        recipeId,
        userRating: null,
        version: null,
      });
      await expect(caller.getAverage({ recipeId })).resolves.toEqual({
        recipeId,
        averageRating: null,
        ratingCount: 0,
      });
      expect(getAverageRating).not.toHaveBeenCalled();
    });
  });

  describe("rate", () => {
    it("rates, and tells the recipe's audience the new average", async () => {
      const recipeId = crypto.randomUUID();

      ratings.publish.mockClear();
      rateRecipe.mockResolvedValue({ rating: 5, isNew: true });
      getAverageRating.mockResolvedValue({ averageRating: 5, ratingCount: 1 });

      await expect(caller().rate({ recipeId, rating: 5, version: 1 })).resolves.toEqual({
        success: true,
      });
      await vi.waitFor(() => expect(ratings.publish).toHaveBeenCalled());
      expect(rateRecipe).toHaveBeenCalledWith(ctx.user.id, recipeId, 5, 1);
      expect(ratings.publish).toHaveBeenCalledWith(
        "ratingUpdated",
        { recipeId, averageRating: 5, ratingCount: 1 },
        expect.objectContaining({ householdId: "another-household" })
      );
    });

    it("logs stale rating mutations as no-ops", async () => {
      const recipeId = crypto.randomUUID();

      rateRecipe.mockResolvedValue({ rating: 2, isNew: false, stale: true });

      const caller = ratingsProcedures.createCaller(ctx as never);
      const result = await caller.rate({ recipeId, rating: 2, version: 7 });

      await Promise.resolve();

      expect(result).toEqual({ success: true });
      expect(rateRecipe).toHaveBeenCalledWith(ctx.user.id, recipeId, 2, 7);
      expect(trpcLogger.info).toHaveBeenCalledWith(
        { userId: ctx.user.id, recipeId, version: 7 },
        "Ignoring stale rating mutation"
      );
    });

    it("removes rating when rating is null", async () => {
      const recipeId = crypto.randomUUID();
      rateRecipe.mockResolvedValue({ rating: null, isNew: false });
      getAverageRating.mockResolvedValue({ averageRating: null, ratingCount: 0 });

      const caller = ratingsProcedures.createCaller(ctx as never);
      const result = await caller.rate({ recipeId, rating: null, version: 3 });

      await Promise.resolve();

      expect(result).toEqual({ success: true });
      expect(rateRecipe).toHaveBeenCalledWith(ctx.user.id, recipeId, null, 3);
      expect(trpcLogger.info).toHaveBeenCalledWith(
        { userId: ctx.user.id, recipeId, rating: null, isNew: false },
        "Recipe rating removed"
      );
    });

    it("tells only the account that rated when the rating fails", async () => {
      const recipeId = crypto.randomUUID();

      policy.view = "everyone";
      ratings.publish.mockClear();
      rateRecipe.mockRejectedValue(new Error("database down"));
      await ratingsProcedures.createCaller(ctx as never).rate({ recipeId, rating: 4, version: 1 });
      await vi.waitFor(() => expect(ratings.publish).toHaveBeenCalled());

      expect(ratings.publish).toHaveBeenCalledWith(
        "ratingFailed",
        { recipeId, reason: "database down" },
        { userId: ctx.user.id }
      );
    });

    it("validates rating is between 1 and 5, or null", async () => {
      const caller = ratingsProcedures.createCaller(ctx as never);
      const validRecipeId = crypto.randomUUID();

      await expect(caller.rate({ recipeId: validRecipeId, rating: 0 })).rejects.toThrow();
      await expect(caller.rate({ recipeId: validRecipeId, rating: 6 })).rejects.toThrow();
    });
  });
});
