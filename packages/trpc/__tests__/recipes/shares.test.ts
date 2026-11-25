// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { recipes } from "../mocks/realtime/recipes";
import {
  createMockAuthedContext,
  createMockFullRecipe,
  createMockHousehold,
  createMockUser,
} from "./test-utils";

const assertRecipeAccessMock = vi.hoisted(() => vi.fn());
const createRecipeShareMock = vi.hoisted(() => vi.fn());
const deleteRecipeShareMock = vi.hoisted(() => vi.fn());
const getActiveRecipeShareByTokenMock = vi.hoisted(() => vi.fn());
const getTimerKeywordsMock = vi.hoisted(() => vi.fn());
const getRecipePermissionPolicyMock = vi.hoisted(() => vi.fn());
const getPublicRecipeViewMock = vi.hoisted(() => vi.fn());
const getRecipeFullMock = vi.hoisted(() => vi.fn());
const getRecipeShareByIdMock = vi.hoisted(() => vi.fn());
const getRecipeSharesByUserIdMock = vi.hoisted(() => vi.fn());
const getRecipeShareUrlMock = vi.hoisted(() => vi.fn());
const getUnitsMock = vi.hoisted(() => vi.fn());
const isTimersEnabledMock = vi.hoisted(() => vi.fn());
const revokeRecipeShareMock = vi.hoisted(() => vi.fn());
const updateRecipeShareMock = vi.hoisted(() => vi.fn());
const getCachedHouseholdForUserMock = vi.hoisted(() => vi.fn());
const isUserServerAdminMock = vi.hoisted(() => vi.fn());
const ingredientIconAddressesMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/routers/recipes/helpers", () => ({
  assertRecipeAccess: assertRecipeAccessMock,
}));

vi.mock("@norish/shared-server/realtime/recipes", () => import("../mocks/realtime/recipes"));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: getRecipePermissionPolicyMock,
  getTimerKeywords: getTimerKeywordsMock,
  getUnits: getUnitsMock,
  isTimersEnabled: isTimersEnabledMock,
}));

vi.mock("@norish/db/repositories/recipe-shares", async () => ({
  toRecipeShareSummary: (await import("@norish/db/repositories/recipe-share-helpers"))
    .toRecipeShareSummary,
  createRecipeShare: createRecipeShareMock,
  deleteRecipeShare: deleteRecipeShareMock,
  getActiveRecipeShareByToken: getActiveRecipeShareByTokenMock,
  getPublicRecipeView: getPublicRecipeViewMock,
  getRecipeShareById: getRecipeShareByIdMock,
  getRecipeShareUrl: getRecipeShareUrlMock,
  getRecipeSharesByUserId: getRecipeSharesByUserIdMock,
  revokeRecipeShare: revokeRecipeShareMock,
  updateRecipeShare: updateRecipeShareMock,
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  getRecipeFull: getRecipeFullMock,
}));

vi.mock("@norish/shared-server/ingredients/icons", () => ({
  ingredientIconAddresses: ingredientIconAddressesMock,
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
    operationId: null,
  };
  const publicCtx = {
    user: null,
    household: null,
    connectionId: null,
    operationId: null,
  };

  beforeEach(() => {
    isUserServerAdminMock.mockResolvedValue(false);
    getCachedHouseholdForUserMock.mockResolvedValue(household);
    getRecipePermissionPolicyMock.mockResolvedValue({ view: "household" });
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
      hasLink: true,
      url: "/share/token-1",
    });

    const result = await caller.shareCreate({ recipeId, expiresIn: "forever" });

    expect(assertRecipeAccessMock).toHaveBeenCalledWith(authedCtx, recipeId, "edit");
    expect(createRecipeShareMock).toHaveBeenCalledWith(user.id, {
      recipeId,
      expiresIn: "forever",
    });
    expect(recipes.publish).toHaveBeenCalledWith(
      "shareEvent",
      {
        kind: "created",
        share: {
          type: "created",
          recipeId,
          shareId,
          version: 1,
        },
      },
      { viewPolicy: "household", userId: user.id, householdId: authedCtx.householdId }
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
      images: [{ image: "/share/valid-token/media/cover.jpg", order: 0 }],
      videos: [],
    });

    const result = await caller.getShared({ token: "valid-token" });

    expect(getActiveRecipeShareByTokenMock).toHaveBeenCalledWith("valid-token", {
      touchLastAccessedAt: true,
    });
    expect(getRecipeFullMock).toHaveBeenCalledWith(recipeId);
    expect(getPublicRecipeViewMock).toHaveBeenCalledWith(
      recipeId,
      "valid-token",
      expect.any(Function)
    );
    expect(result.images).toEqual([{ image: "/share/valid-token/media/cover.jpg", order: 0 }]);

    // The lines' icons are read by address, the way every surface reads them.
    expect(getPublicRecipeViewMock.mock.calls[0]![2]).toBe(ingredientIconAddressesMock);
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

  it("gives a server admin no way into another user's share", async () => {
    const admin = recipeSharesProcedures.createCaller({
      ...createMockAuthedContext(createMockUser({ isServerAdmin: true }), household),
      connectionId: null,
      operationId: null,
    } as never);

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

    for (const attempt of [
      () => admin.shareUrl({ id: shareId }),
      () => admin.shareRevoke({ id: shareId, version: 1 }),
      () => admin.shareReactivate({ id: shareId, version: 1 }),
      () => admin.shareDelete({ id: shareId, version: 1 }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  describe("a share's link", () => {
    const ownShare = {
      id: shareId,
      userId: user.id,
      recipeId,
      tokenHash: "hashed",
      tokenEnc: "encrypted",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    beforeEach(() => {
      assertRecipeAccessMock.mockResolvedValue(undefined);
      getRecipeShareUrlMock.mockReturnValue("/share/token-1");
    });

    it("is given to the share's owner after the revoke check", async () => {
      const caller = recipeSharesProcedures.createCaller(authedCtx as never);

      getRecipeShareByIdMock.mockResolvedValue(ownShare);

      await expect(caller.shareUrl({ id: shareId })).resolves.toEqual({ url: "/share/token-1" });
      expect(assertRecipeAccessMock).toHaveBeenCalledWith(
        expect.objectContaining({ user }),
        recipeId,
        "edit"
      );
    });

    it("is null for a share made before links were kept", async () => {
      const caller = recipeSharesProcedures.createCaller(authedCtx as never);

      getRecipeShareByIdMock.mockResolvedValue({ ...ownShare, tokenEnc: null });
      getRecipeShareUrlMock.mockReturnValue(null);

      await expect(caller.shareUrl({ id: shareId })).resolves.toEqual({ url: null });
    });

    it("is not given to the owner once they lose edit access to the recipe", async () => {
      const caller = recipeSharesProcedures.createCaller(authedCtx as never);

      getRecipeShareByIdMock.mockResolvedValue(ownShare);
      assertRecipeAccessMock.mockRejectedValue(
        Object.assign(new Error("no"), { code: "FORBIDDEN" })
      );

      await expect(caller.shareUrl({ id: shareId })).rejects.toThrow();
      expect(getRecipeShareUrlMock).not.toHaveBeenCalled();
    });

    it("answers another household member and an outsider as for a missing share", async () => {
      const member = createMockUser({ id: "household-member-id" });
      const outsider = createMockUser({ id: "outsider-user" });
      const memberCtx = { ...authedCtx, ...createMockAuthedContext(member, household) };
      const outsiderCtx = {
        ...authedCtx,
        ...createMockAuthedContext(
          outsider,
          createMockHousehold({
            id: "outsider-household",
            adminUserId: outsider.id,
            users: [{ id: outsider.id, name: "Outsider" }],
          })
        ),
      };

      getRecipeShareByIdMock.mockResolvedValue(null);
      const missing = await recipeSharesProcedures
        .createCaller(authedCtx as never)
        .shareUrl({ id: shareId })
        .catch((error: unknown) => error);

      getRecipeShareByIdMock.mockResolvedValue(ownShare);
      for (const ctx of [memberCtx, outsiderCtx]) {
        await expect(
          recipeSharesProcedures.createCaller(ctx as never).shareUrl({ id: shareId })
        ).rejects.toMatchObject({ code: "NOT_FOUND", message: (missing as Error).message });
      }
      expect(getRecipeShareUrlMock).not.toHaveBeenCalled();
    });
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
        hasLink: true,
      },
    });

    await caller.shareUpdate({ id: shareId, version: 1, expiresIn: "1month" });

    expect(recipes.publish).toHaveBeenCalledWith(
      "shareEvent",
      {
        kind: "updated",
        share: {
          type: "updated",
          recipeId,
          shareId,
          version: 2,
        },
      },
      { viewPolicy: "household", userId: user.id, householdId: authedCtx.householdId }
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
        hasLink: true,
      },
    });

    await caller.shareRevoke({ id: shareId, version: 2 });

    expect(recipes.publish).toHaveBeenCalledWith(
      "shareEvent",
      {
        kind: "revoked",
        share: {
          type: "revoked",
          recipeId,
          shareId,
          version: 3,
        },
      },
      { viewPolicy: "household", userId: user.id, householdId: authedCtx.householdId }
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

    expect(recipes.publish).toHaveBeenCalledWith(
      "shareEvent",
      {
        kind: "deleted",
        share: {
          type: "deleted",
          recipeId,
          shareId,
          version: 4,
        },
      },
      { viewPolicy: "household", userId: user.id, householdId: authedCtx.householdId }
    );
  });
});

describe("the public view of a shared recipe", () => {
  it("carries each line's Ingredient Icon by address, and no ids", async () => {
    const { mapRecipeToPublicRecipeView } =
      await import("@norish/db/repositories/recipe-share-helpers");
    const recipe = createMockFullRecipe();
    const ingredientId = recipe.recipeIngredients[0]!.ingredientId!;

    const view = mapRecipeToPublicRecipeView(
      recipe,
      "public-token",
      new Map([[ingredientId, "/ingredient-icons/0123456789abcdef0123456789abcdef.webp"]])
    );

    expect(view.recipeIngredients[0]).toMatchObject({
      icon: "/ingredient-icons/0123456789abcdef0123456789abcdef.webp",
    });
    expect(view.recipeIngredients[0]).not.toHaveProperty("ingredientId");
    expect(view.recipeIngredients[0]).not.toHaveProperty("id");
  });

  it("gives a line with no icon, or no food, the placeholder", async () => {
    const { mapRecipeToPublicRecipeView } =
      await import("@norish/db/repositories/recipe-share-helpers");
    const view = mapRecipeToPublicRecipeView(createMockFullRecipe(), "public-token", new Map());

    expect(view.recipeIngredients.every((line) => line.icon === null)).toBe(true);
  });
});
