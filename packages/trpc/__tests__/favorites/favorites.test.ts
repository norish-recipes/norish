// @vitest-environment node
/**
 * Favourites through the real procedures: a reader favourites only what they may view, and a
 * favourite out of view reads as none, through the viewer every read hands the repository.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";
import { favoritesProcedures } from "@norish/trpc/routers/favorites/favorites";

import {
  getFavoriteRecipesWithVersions,
  getFavoritesByRecipeIds,
  resetFavoritesMocks,
  setFavorite,
} from "../mocks/favorites-repository";
import { policy, resetPermissionsMocks } from "../mocks/permissions";
import { everyRecipeIn, resetRecipesMocks } from "../mocks/recipes-repository";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

vi.mock("@norish/db/repositories/favorites", () => import("../mocks/favorites-repository"));
vi.mock("@norish/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db")>()),
  getRecipeHouseholdIds: (await import("../mocks/recipes-repository")).getRecipeHouseholdIds,
}));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const RECIPE = "11111111-1111-4111-8111-111111111111";

describe("favorites procedures", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());
  const caller = () => favoritesProcedures.createCaller(ctx as never);
  const viewer = { userId: ctx.user.id, householdId: ctx.householdId };

  beforeEach(() => {
    resetFavoritesMocks();
    resetPermissionsMocks();
    resetRecipesMocks();
    everyRecipeIn("another-household");
    setFavorite.mockResolvedValue({ stale: false, value: { isFavorite: true } });
  });

  it("favourites a recipe the reader may view", async () => {
    await expect(caller().toggle({ recipeId: RECIPE, isFavorite: true })).resolves.toEqual({
      recipeId: RECIPE,
      isFavorite: true,
      stale: false,
    });
    expect(setFavorite).toHaveBeenCalledWith(ctx.user.id, RECIPE, true, undefined);
  });

  it("answers a recipe out of view as a gone one, and favourites nothing", async () => {
    policy.view = "household";

    await expect(caller().toggle({ recipeId: RECIPE, isFavorite: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(setFavorite).not.toHaveBeenCalled();
  });

  it("logs a stale favorite mutation as a no-op", async () => {
    setFavorite.mockResolvedValue({ stale: true, value: { isFavorite: false } });

    const result = await caller().toggle({ recipeId: RECIPE, isFavorite: false, version: 3 });

    expect(setFavorite).toHaveBeenCalledWith(ctx.user.id, RECIPE, false, 3);
    expect(result).toEqual({ recipeId: RECIPE, isFavorite: false, stale: true });
    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, recipeId: RECIPE, version: 3 },
      "Ignoring stale favorite mutation"
    );
  });

  it("reads every favourite as the reader, so the repository applies the policy", async () => {
    getFavoritesByRecipeIds.mockResolvedValue(new Set([RECIPE]));
    getFavoriteRecipesWithVersions.mockResolvedValue([{ recipeId: RECIPE, version: 2 }]);

    await expect(caller().check({ recipeId: RECIPE })).resolves.toEqual({
      recipeId: RECIPE,
      isFavorite: true,
    });
    await expect(caller().batchCheck({ recipeIds: [RECIPE] })).resolves.toEqual({
      favoriteIds: [RECIPE],
    });
    await expect(caller().list()).resolves.toEqual({
      favoriteIds: [RECIPE],
      favoriteVersions: { [RECIPE]: 2 },
    });
    expect(getFavoritesByRecipeIds).toHaveBeenCalledWith(viewer, [RECIPE]);
    expect(getFavoriteRecipesWithVersions).toHaveBeenCalledWith(viewer);
  });
});
