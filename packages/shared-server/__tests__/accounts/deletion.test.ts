// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteUserAccount } from "@norish/shared-server/accounts/deletion";

const repositories = vi.hoisted(() => ({
  getHouseholdForUser: vi.fn(),
  transferHouseholdAdmin: vi.fn(),
  deleteUser: vi.fn(),
  sweepUserAvatars: vi.fn(),
  emitConnectionInvalidation: vi.fn(),
}));

vi.mock("@norish/db/repositories/households", () => ({
  getHouseholdForUser: repositories.getHouseholdForUser,
  transferHouseholdAdmin: repositories.transferHouseholdAdmin,
}));

vi.mock("@norish/db/repositories/users", () => ({
  deleteUser: repositories.deleteUser,
}));

vi.mock("@norish/shared-server/media/avatar-cleanup", () => ({
  sweepUserAvatars: repositories.sweepUserAvatars,
}));

vi.mock("@norish/shared-server/realtime/connection-invalidation", () => ({
  emitConnectionInvalidation: repositories.emitConnectionInvalidation,
}));

vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function household(adminUserId: string, memberIds: readonly string[]) {
  return {
    id: "household-1",
    name: "Household",
    adminUserId,
    users: memberIds.map((id) => ({ id, name: id, isAdmin: id === adminUserId, version: 1 })),
  };
}

describe("deleteUserAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositories.getHouseholdForUser.mockResolvedValue(null);
    repositories.transferHouseholdAdmin.mockResolvedValue(undefined);
    repositories.deleteUser.mockResolvedValue(undefined);
    repositories.sweepUserAvatars.mockResolvedValue(undefined);
    repositories.emitConnectionInvalidation.mockResolvedValue(undefined);
  });

  it("sweeps avatars, deletes the row, and cuts live connections", async () => {
    await deleteUserAccount("user-1");

    expect(repositories.sweepUserAvatars).toHaveBeenCalledWith("user-1");
    expect(repositories.deleteUser).toHaveBeenCalledWith("user-1");
    expect(repositories.emitConnectionInvalidation).toHaveBeenCalledWith(
      "user-1",
      "account-deleted"
    );
  });

  it("hands the household to a remaining member before deleting its admin", async () => {
    repositories.getHouseholdForUser.mockResolvedValue(household("user-1", ["user-1", "user-2"]));

    await deleteUserAccount("user-1");

    expect(repositories.transferHouseholdAdmin).toHaveBeenCalledWith(
      "household-1",
      "user-1",
      "user-2"
    );
  });

  it("hands the household on before the row that cascades it is deleted", async () => {
    const order: string[] = [];

    repositories.getHouseholdForUser.mockResolvedValue(household("user-1", ["user-1", "user-2"]));
    repositories.transferHouseholdAdmin.mockImplementation(async () => {
      order.push("transfer");
    });
    repositories.deleteUser.mockImplementation(async () => {
      order.push("delete");
    });

    await deleteUserAccount("user-1");

    expect(order).toEqual(["transfer", "delete"]);
  });

  it("lets a household with nobody left in it go with the cascade", async () => {
    repositories.getHouseholdForUser.mockResolvedValue(household("user-1", ["user-1"]));

    await deleteUserAccount("user-1");

    expect(repositories.transferHouseholdAdmin).not.toHaveBeenCalled();
    expect(repositories.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("leaves a household alone when the deleted user does not administer it", async () => {
    repositories.getHouseholdForUser.mockResolvedValue(household("user-2", ["user-1", "user-2"]));

    await deleteUserAccount("user-1");

    expect(repositories.transferHouseholdAdmin).not.toHaveBeenCalled();
  });

  it("does nothing about households for a user who is in none", async () => {
    await deleteUserAccount("user-1");

    expect(repositories.transferHouseholdAdmin).not.toHaveBeenCalled();
    expect(repositories.deleteUser).toHaveBeenCalledWith("user-1");
  });
});
