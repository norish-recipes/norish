// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountDeletion } from "@norish/db/repositories/households";
import { deleteUserAccount } from "@norish/auth/account-deletion";

const order: string[] = [];
const step = (name: string) =>
  vi.fn(async (...args: unknown[]) => {
    order.push(`${name}${args.length ? ` ${JSON.stringify(args)}` : ""}`);
  });

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  getHouseholdById: vi.fn(),
  deleteUserSessions: vi.fn(),
  sweepUserAvatars: vi.fn(),
  deleteRecipeImagesDir: vi.fn(),
  sweepCookbookImages: vi.fn(),
  invalidateHouseholdCacheForUsers: vi.fn(),
  bumpViewEpoch: vi.fn(),
  emitConnectionInvalidation: vi.fn(),
  householdsPublish: vi.fn(),
  recipesPublish: vi.fn(),
  cookbooksPublish: vi.fn(),
  publishCalendarItemEvent: vi.fn(),
}));

vi.mock("@norish/auth/auth", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: { deleteUserSessions: mocks.deleteUserSessions },
    }),
  },
}));
vi.mock("@norish/db/repositories/households", () => ({
  deleteAccount: mocks.deleteAccount,
  getHouseholdById: mocks.getHouseholdById,
}));
vi.mock("@norish/shared-server/media/avatar-cleanup", () => ({
  sweepUserAvatars: mocks.sweepUserAvatars,
}));
vi.mock("@norish/shared-server/media/storage", () => ({
  deleteRecipeImagesDir: mocks.deleteRecipeImagesDir,
  sweepCookbookImages: mocks.sweepCookbookImages,
}));
vi.mock("@norish/shared-server/cache/household", () => ({
  invalidateHouseholdCacheForUsers: mocks.invalidateHouseholdCacheForUsers,
}));
vi.mock("@norish/shared-server/realtime/resume", () => ({ bumpViewEpoch: mocks.bumpViewEpoch }));
vi.mock("@norish/shared-server/realtime/connection", () => ({
  emitConnectionInvalidation: mocks.emitConnectionInvalidation,
}));
vi.mock("@norish/shared-server/realtime/households", () => ({
  households: { publish: mocks.householdsPublish },
}));
vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipes: { publish: mocks.recipesPublish },
}));
vi.mock("@norish/shared-server/realtime/cookbooks", () => ({
  cookbooks: { publish: mocks.cookbooksPublish },
}));
vi.mock("@norish/shared-server/realtime/calendar-items", () => ({
  publishCalendarItemEvent: mocks.publishCalendarItemEvent,
}));
vi.mock("@norish/shared-server/realtime/audience", () => ({
  policyAudience: async (householdId: string) => ({ viewPolicy: "everyone", householdId }),
}));
vi.mock("@norish/shared-server/logger", () => ({
  authLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const NOTE = {
  id: "plan-1",
  householdId: "elsewhere",
  userId: "stranger",
  date: "2031-05-06",
  slot: "Dinner",
  sortOrder: 0,
  itemType: "note",
  recipeId: null,
  title: "Soep",
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 2,
} as const;

const DELETION: AccountDeletion = {
  householdId: "home",
  householdErased: false,
  successorId: "member",
  memberIds: ["member"],
  recipeIds: ["recipe-1"],
  cookbookIds: ["cookbook-1"],
  notes: [NOTE],
};

describe("deleteUserAccount", () => {
  beforeEach(() => {
    order.length = 0;
    vi.clearAllMocks();
    mocks.deleteAccount.mockImplementation(async () => {
      order.push("delete");

      return DELETION;
    });
    mocks.getHouseholdById.mockResolvedValue({ id: "home", version: 7 });
    for (const [name, mock] of Object.entries(mocks)) {
      if (name !== "deleteAccount" && name !== "getHouseholdById")
        mock.mockImplementation(step(name));
    }
  });

  it("ends sessions, rescopes the account, tells everyone else, then sweeps the files", async () => {
    await deleteUserAccount("gone");

    expect(order).toEqual([
      "delete",
      'deleteUserSessions ["gone"]',
      'invalidateHouseholdCacheForUsers [["gone","member"]]',
      "bumpViewEpoch",
      'emitConnectionInvalidation ["gone","account-deleted"]',
      'householdsPublish ["memberRemoved",{"userId":"gone"},{"householdId":"home"}]',
      'householdsPublish ["adminTransferred",{"oldAdminId":"gone","newAdminId":"member","version":7},{"householdId":"home"}]',
      'recipesPublish ["deleted",{"ids":["recipe-1"]},{"viewPolicy":"everyone","householdId":"home"}]',
      'cookbooksPublish ["deleted",{"id":"cookbook-1"},{"viewPolicy":"everyone","householdId":"home"}]',
      `publishCalendarItemEvent ${JSON.stringify([
        "itemUpdated",
        {
          item: {
            id: "plan-1",
            date: "2031-05-06",
            slot: "Dinner",
            sortOrder: 0,
            itemType: "note",
            recipeId: null,
            title: "Soep",
            userId: "stranger",
            version: 2,
            recipeName: null,
            recipeImage: null,
            servings: null,
            calories: null,
          },
        },
        "elsewhere",
      ])}`,
      'sweepUserAvatars ["gone"]',
      'deleteRecipeImagesDir ["recipe-1"]',
      'sweepCookbookImages ["cookbook-1"]',
    ]);
  });

  it("tells no member of an erased household, but still the readers of what it held", async () => {
    mocks.deleteAccount.mockResolvedValue({
      ...DELETION,
      householdErased: true,
      successorId: null,
      memberIds: [],
      notes: [],
    });

    await deleteUserAccount("gone");

    expect(mocks.householdsPublish).not.toHaveBeenCalled();
    expect(mocks.recipesPublish).toHaveBeenCalledOnce();
    expect(mocks.cookbooksPublish).toHaveBeenCalledOnce();
    expect(mocks.emitConnectionInvalidation).toHaveBeenCalledWith("gone", "account-deleted");
  });

  it("reports the committed deletion and runs every later step when one fails", async () => {
    mocks.deleteUserSessions.mockRejectedValue(new Error("valkey down"));
    mocks.householdsPublish.mockRejectedValue(new Error("publish failed"));
    mocks.recipesPublish.mockRejectedValue(new Error("publish failed"));

    await expect(deleteUserAccount("gone")).resolves.toBeUndefined();
    expect(mocks.emitConnectionInvalidation).toHaveBeenCalledWith("gone", "account-deleted");
    expect(mocks.householdsPublish).toHaveBeenCalledTimes(2);
    expect(mocks.cookbooksPublish).toHaveBeenCalledOnce();
    expect(mocks.publishCalendarItemEvent).toHaveBeenCalledOnce();
    expect(mocks.deleteRecipeImagesDir).toHaveBeenCalledWith("recipe-1");
    expect(mocks.sweepUserAvatars).toHaveBeenCalledWith("gone");
  });

  it("keeps the deletion when a file sweep fails, and sweeps the rest", async () => {
    mocks.sweepUserAvatars.mockRejectedValue(new Error("disk"));

    await expect(deleteUserAccount("gone")).resolves.toBeUndefined();
    expect(mocks.deleteRecipeImagesDir).toHaveBeenCalledWith("recipe-1");
    expect(mocks.sweepCookbookImages).toHaveBeenCalledWith("cookbook-1");
  });

  it("keeps every file of an account whose deletion failed", async () => {
    mocks.deleteAccount.mockRejectedValue(new Error("connection lost"));

    await expect(deleteUserAccount("gone")).rejects.toThrow("connection lost");
    expect(mocks.sweepUserAvatars).not.toHaveBeenCalled();
    expect(mocks.deleteRecipeImagesDir).not.toHaveBeenCalled();
    expect(mocks.emitConnectionInvalidation).not.toHaveBeenCalled();
  });
});
