// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteUserAccount } from "@norish/auth/account-deletion";

const repositories = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  sweepUserAvatars: vi.fn(),
  emitConnectionInvalidation: vi.fn(),
  deleteUserSessions: vi.fn(),
}));

vi.mock("@norish/auth/auth", () => ({
  auth: {
    $context: Promise.resolve({
      internalAdapter: { deleteUserSessions: repositories.deleteUserSessions },
    }),
  },
}));

vi.mock("@norish/db/repositories/households", () => ({
  deleteAccount: repositories.deleteAccount,
}));

vi.mock("@norish/shared-server/media/avatar-cleanup", () => ({
  sweepUserAvatars: repositories.sweepUserAvatars,
}));

vi.mock("@norish/shared-server/realtime/connection", () => ({
  emitConnectionInvalidation: repositories.emitConnectionInvalidation,
}));

vi.mock("@norish/shared-server/logger", () => ({
  authLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("deleteUserAccount", () => {
  beforeEach(() => {
    repositories.deleteAccount.mockResolvedValue(null);
    repositories.sweepUserAvatars.mockResolvedValue(undefined);
    repositories.emitConnectionInvalidation.mockResolvedValue(undefined);
    repositories.deleteUserSessions.mockResolvedValue(undefined);
  });

  it("deletes the account, then sweeps avatars, ends its sessions and cuts live connections", async () => {
    const order: string[] = [];

    repositories.deleteAccount.mockImplementation(async () => void order.push("delete"));
    repositories.sweepUserAvatars.mockImplementation(async () => void order.push("sweep"));
    repositories.emitConnectionInvalidation.mockImplementation(
      async () => void order.push("invalidate")
    );

    await deleteUserAccount("user-1");

    expect(repositories.sweepUserAvatars).toHaveBeenCalledWith("user-1");
    expect(repositories.deleteAccount).toHaveBeenCalledWith("user-1");
    expect(repositories.deleteUserSessions).toHaveBeenCalledWith("user-1");
    expect(repositories.emitConnectionInvalidation).toHaveBeenCalledWith(
      "user-1",
      "account-deleted"
    );
    expect(order).toEqual(["delete", "sweep", "invalidate"]);
  });

  it("keeps the avatar files of an account whose deletion failed", async () => {
    repositories.deleteAccount.mockRejectedValue(new Error("connection lost"));

    await expect(deleteUserAccount("user-1")).rejects.toThrow("connection lost");
    expect(repositories.sweepUserAvatars).not.toHaveBeenCalled();
  });
});
