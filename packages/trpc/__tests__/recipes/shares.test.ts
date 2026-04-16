// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockAuthedContext,
  createMockFullRecipe,
  createMockHousehold,
  createMockUser,
} from "./test-utils";

const assertRecipeAccessMock = vi.hoisted(() => vi.fn());
const createRecipeShareMock = vi.hoisted(() => vi.fn());
const deleteRecipeShareMock = vi.hoisted(() => vi.fn());
const emitByPolicyMock = vi.hoisted(() => vi.fn());
const getActiveRecipeShareByTokenMock = vi.hoisted(() => vi.fn());
const getTimerKeywordsMock = vi.hoisted(() => vi.fn());
const getRecipePermissionPolicyMock = vi.hoisted(() => vi.fn());
const getPublicRecipeViewMock = vi.hoisted(() => vi.fn());
const getRecipeFullMock = vi.hoisted(() => vi.fn());
const getRecipeShareByIdMock = vi.hoisted(() => vi.fn());
const getRecipeSharesByUserIdMock = vi.hoisted(() => vi.fn());
const getRecipeShareStatusMock = vi.hoisted(() => vi.fn());
const getUnitsMock = vi.hoisted(() => vi.fn());
const isTimersEnabledMock = vi.hoisted(() => vi.fn());
const revokeRecipeShareMock = vi.hoisted(() => vi.fn());
const updateRecipeShareMock = vi.hoisted(() => vi.fn());
const getCachedHouseholdForUserMock = vi.hoisted(() => vi.fn());
const isUserServerAdminMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/routers/recipes/helpers", () => ({
  assertRecipeAccess: assertRecipeAccessMock,
}));

vi.mock("../../src/helpers", () => ({
  emitByPolicy: emitByPolicyMock,
}));

vi.mock("@norish/config/server-config-loader", () => ({
  getRecipePermissionPolicy: getRecipePermissionPolicyMock,
  getTimerKeywords: getTimerKeywordsMock,
  getUnits: getUnitsMock,
  isTimersEnabled: isTimersEnabledMock,
}));

vi.mock("@norish/db/repositories/recipe-shares", () => ({
  createRecipeShare: createRecipeShareMock,
  deleteRecipeShare: deleteRecipeShareMock,
  getActiveRecipeShareByToken: getActiveRecipeShareByTokenMock,
  getPublicRecipeView: getPublicRecipeViewMock,
  getRecipeShareById: getRecipeShareByIdMock,
  getRecipeShareStatus: getRecipeShareStatusMock,
  getRecipeSharesByUserId: getRecipeSharesByUserIdMock,
  revokeRecipeShare: revokeRecipeShareMock,
  updateRecipeShare: updateRecipeShareMock,
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  getRecipeFull: getRecipeFullMock,
}));

vi.mock("@norish/db", () => ({
  getCachedHouseholdForUser: getCachedHouseholdForUserMock,
  isUserServerAdmin: isUserServerAdminMock,
}));

const { recipeSharesProcedures } = await import("../../src/routers/recipes/shares");

describe("recipe share procedures", () => {
  const user = createMockUser();
  const household = createMockHousehold();
  const recipeId = "123e4567-e89b-12d3-a456-426614174000";
  const shareId = "123e4567-e89b-12d3-a456-426614174001";
  const authedCtx = {
    ...createMockAuthedContext(user, household),
    connectionId: null,
    multiplexer: null,
    operationId: null,
  };
  const publicCtx = {
    user: null,
    household: null,
    connectionId: null,
    multiplexer: null,
    operationId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isUserServerAdminMock.mockResolvedValue(false);
    getCachedHouseholdForUserMock.mockResolvedValue(household);
    getRecipePermissionPolicyMock.mockResolvedValue({ view: "household" });
    getRecipeShareStatusMock.mockReturnValue("active");
    getUnitsMock.mockResolvedValue({});
    isTimersEnabledMock.mockResolvedValue(true);
    getTimerKeywordsMock.mockResolvedValue({
      enabled: true,
      hours: ["hour"],
      minutes: ["minute"],
      seconds: ["second"],
      isOverridden: false,
    });
  });

  it("creates a share after enforcing recipe edit access", async () => {
    const caller = recipeSharesProcedures.createCaller(authedCtx as never);

    assertRecipeAccessMock.mockResolvedValue(undefined);
    createRecipeShareMock.mockResolvedValue({
      id: shareId,
      userId: user.id,
      recipeId,
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      status: "active",
      url: "/share/token-1",
    });

    const result = await caller.shareCreate({ recipeId, expiresIn: "forever" });

    expect(assertRecipeAccessMock).toHaveBeenCalledWith(authedCtx, recipeId, "edit");
    expect(createRecipeShareMock).toHaveBeenCalledWith(user.id, {
      recipeId,
      expiresIn: "forever",
    });
    expect(emitByPolicyMock).toHaveBeenCalledWith(
      expect.anything(),
      "household",
      { userId: user.id, householdKey: authedCtx.householdKey },
      "shareCreated",
      {
        type: "created",
        recipeId,
        shareId,
        version: 1,
      }
    );
    expect(result.url).toBe("/share/token-1");
  });

  it("returns the public recipe for a valid anonymous token", async () => {
    const caller = recipeSharesProcedures.createCaller(publicCtx as never);
    const recipe = createMockFullRecipe({ id: recipeId });

    getActiveRecipeShareByTokenMock.mockResolvedValue({
      id: shareId,
      userId: user.id,
      recipeId,
      tokenHash: "hashed",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 2,
    });
    getRecipeFullMock.mockResolvedValue(recipe);
    getPublicRecipeViewMock.mockResolvedValue({
      name: recipe.name,
      description: recipe.description,
      notes: recipe.notes ?? null,
      url: recipe.url,
      image: `/share/valid-token/media/cover.jpg`,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      totalMinutes: recipe.totalMinutes,
      systemUsed: recipe.systemUsed,
      calories: recipe.calories,
      fat: recipe.fat,
      carbs: recipe.carbs,
      protein: recipe.protein,
      categories: recipe.categories,
      tags: [{ name: "dinner" }],
      recipeIngredients: [
        {
          ingredientName: "Flour",
          amount: 200,
          unit: "g",
          systemUsed: "metric",
          order: 0,
        },
      ],
      steps: [{ step: "Mix", systemUsed: "metric", order: 0, images: [] }],
      author: { name: "Test User", image: null },
      images: [],
      videos: [],
    });

    const result = await caller.getShared({ token: "valid-token" });

    expect(getActiveRecipeShareByTokenMock).toHaveBeenCalledWith("valid-token", {
      touchLastAccessedAt: true,
    });
    expect(getRecipeFullMock).toHaveBeenCalledWith(recipeId);
    expect(getPublicRecipeViewMock).toHaveBeenCalledWith(recipeId, "valid-token");
    expect(result.image).toBe("/share/valid-token/media/cover.jpg");
  });

  it("returns the public share config for a valid share token", async () => {
    const caller = recipeSharesProcedures.createCaller(publicCtx as never);

    getActiveRecipeShareByTokenMock.mockResolvedValue({
      id: shareId,
      userId: user.id,
      recipeId,
      tokenHash: "hashed",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 2,
    });
    getRecipeFullMock.mockResolvedValue(createMockFullRecipe({ id: recipeId }));
    getUnitsMock.mockResolvedValue({
      gram: {
        short: [{ locale: "en", name: "g" }],
        plural: [{ locale: "en", name: "grams" }],
        alternates: ["gram"],
      },
    });
    isTimersEnabledMock.mockResolvedValue(false);
    getTimerKeywordsMock.mockResolvedValue({
      enabled: true,
      hours: ["hr"],
      minutes: ["min"],
      seconds: ["sec"],
      isOverridden: true,
    });

    const result = await caller.sharePublicConfig({ token: "valid-token" });

    expect(getActiveRecipeShareByTokenMock).toHaveBeenCalledWith("valid-token", {
      touchLastAccessedAt: true,
    });
    expect(getUnitsMock).toHaveBeenCalledOnce();
    expect(isTimersEnabledMock).toHaveBeenCalledOnce();
    expect(getTimerKeywordsMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      units: {
        gram: {
          short: [{ locale: "en", name: "g" }],
          plural: [{ locale: "en", name: "grams" }],
          alternates: ["gram"],
        },
      },
      timersEnabled: false,
      timerKeywords: {
        enabled: true,
        hours: ["hr"],
        minutes: ["min"],
        seconds: ["sec"],
        isOverridden: true,
      },
    });
  });

  it("rejects public share config requests for invalid tokens", async () => {
    const caller = recipeSharesProcedures.createCaller(publicCtx as never);

    getActiveRecipeShareByTokenMock.mockResolvedValue(null);

    await expect(caller.sharePublicConfig({ token: "invalid-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(getUnitsMock).not.toHaveBeenCalled();
    expect(isTimersEnabledMock).not.toHaveBeenCalled();
    expect(getTimerKeywordsMock).not.toHaveBeenCalled();
  });

  it("rejects invalid, expired, and revoked public tokens with the same not-found error", async () => {
    const caller = recipeSharesProcedures.createCaller(publicCtx as never);

    getActiveRecipeShareByTokenMock.mockResolvedValue(null);

    await expect(caller.getShared({ token: "invalid-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.getShared({ token: "expired-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.getShared({ token: "revoked-token" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("does not allow a user to manage another user's share", async () => {
    const caller = recipeSharesProcedures.createCaller(authedCtx as never);

    getRecipeShareByIdMock.mockResolvedValue({
      id: shareId,
      userId: "other-user",
      recipeId,
      tokenHash: "hashed",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });

    await expect(caller.shareGet({ id: shareId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(assertRecipeAccessMock).not.toHaveBeenCalled();
  });

  it("emits a policy-scoped realtime event when a share is updated", async () => {
    const caller = recipeSharesProcedures.createCaller(authedCtx as never);

    getRecipeShareByIdMock.mockResolvedValue({
      id: shareId,
      userId: user.id,
      recipeId,
      tokenHash: "hashed",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });
    updateRecipeShareMock.mockResolvedValue({
      stale: false,
      value: {
        id: shareId,
        userId: user.id,
        recipeId,
        expiresAt: null,
        revokedAt: null,
        lastAccessedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 2,
        status: "active",
      },
    });

    await caller.shareUpdate({ id: shareId, version: 1, expiresIn: "1month" });

    expect(emitByPolicyMock).toHaveBeenCalledWith(
      expect.anything(),
      "household",
      { userId: user.id, householdKey: authedCtx.householdKey },
      "shareUpdated",
      {
        type: "updated",
        recipeId,
        shareId,
        version: 2,
      }
    );
  });

  it("emits a policy-scoped realtime event when a share is revoked", async () => {
    const caller = recipeSharesProcedures.createCaller(authedCtx as never);

    getRecipeShareByIdMock.mockResolvedValue({
      id: shareId,
      userId: user.id,
      recipeId,
      tokenHash: "hashed",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 2,
    });
    revokeRecipeShareMock.mockResolvedValue({
      stale: false,
      value: {
        id: shareId,
        userId: user.id,
        recipeId,
        expiresAt: null,
        revokedAt: new Date(),
        lastAccessedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 3,
        status: "revoked",
      },
    });

    await caller.shareRevoke({ id: shareId, version: 2 });

    expect(emitByPolicyMock).toHaveBeenCalledWith(
      expect.anything(),
      "household",
      { userId: user.id, householdKey: authedCtx.householdKey },
      "shareRevoked",
      {
        type: "revoked",
        recipeId,
        shareId,
        version: 3,
      }
    );
  });

  it("emits a policy-scoped realtime event when a share is deleted", async () => {
    const caller = recipeSharesProcedures.createCaller(authedCtx as never);

    getRecipeShareByIdMock.mockResolvedValue({
      id: shareId,
      userId: user.id,
      recipeId,
      tokenHash: "hashed",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 4,
    });
    deleteRecipeShareMock.mockResolvedValue({ stale: false });

    await caller.shareDelete({ id: shareId, version: 4 });

    expect(emitByPolicyMock).toHaveBeenCalledWith(
      expect.anything(),
      "household",
      { userId: user.id, householdKey: authedCtx.householdKey },
      "shareDeleted",
      {
        type: "deleted",
        recipeId,
        shareId,
        version: 4,
      }
    );
  });
});
