// @vitest-environment node
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usersProcedures } from "@norish/trpc/routers/admin/users";

import {
  getUserRoleFlags,
  isUserServerAdmin,
  listUsersForAdmin,
  resetUsersMocks,
  setUserAdminStatus,
} from "../mocks/users";
import { createMockAdminContext, createMockAdminUser } from "./test-utils";

const deleteUserAccount = vi.hoisted(() => vi.fn());

vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/shared-server/accounts/deletion", () => ({ deleteUserAccount }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const admin = createMockAdminUser({ id: "admin-1" });

function createCaller() {
  const ctx = createMockAdminContext(admin);

  return usersProcedures.createCaller(ctx as never);
}

describe("admin users router", () => {
  beforeEach(() => {
    resetUsersMocks();
    deleteUserAccount.mockReset();
    deleteUserAccount.mockResolvedValue(undefined);
    isUserServerAdmin.mockImplementation((userId: string) => Promise.resolve(userId === admin.id));
  });

  it("lists users from the repository", async () => {
    const rows = [
      {
        id: "u1",
        name: "Alice",
        email: "alice@example.com",
        image: null,
        isServerOwner: true,
        isServerAdmin: true,
        createdAt: 1000,
        household: null,
      },
    ];

    listUsersForAdmin.mockResolvedValue(rows);

    const caller = createCaller();
    const result = await caller.list();

    expect(result).toEqual(rows);
  });

  describe("setAdminStatus", () => {
    it("grants admin access to another user", async () => {
      getUserRoleFlags.mockResolvedValue({ isServerOwner: false, isServerAdmin: false });
      setUserAdminStatus.mockResolvedValue(undefined);

      const caller = createCaller();
      const result = await caller.setAdminStatus({ userId: "other-1", isAdmin: true });

      expect(setUserAdminStatus).toHaveBeenCalledWith("other-1", true);
      expect(result).toEqual({ success: true });
    });

    it("refuses to let an admin remove their own admin access", async () => {
      const caller = createCaller();

      await expect(
        caller.setAdminStatus({ userId: admin.id, isAdmin: false })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" } satisfies Partial<TRPCError>);

      expect(setUserAdminStatus).not.toHaveBeenCalled();
    });

    it("refuses to change the server owner's admin status", async () => {
      getUserRoleFlags.mockResolvedValue({ isServerOwner: true, isServerAdmin: true });

      const caller = createCaller();

      await expect(
        caller.setAdminStatus({ userId: "owner-1", isAdmin: false })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" } satisfies Partial<TRPCError>);

      expect(setUserAdminStatus).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND for an unknown user", async () => {
      getUserRoleFlags.mockResolvedValue(null);

      const caller = createCaller();

      await expect(caller.setAdminStatus({ userId: "ghost", isAdmin: true })).rejects.toMatchObject(
        { code: "NOT_FOUND" } satisfies Partial<TRPCError>
      );
    });
  });

  describe("remove", () => {
    it("deletes another user through the shared account-deletion routine", async () => {
      getUserRoleFlags.mockResolvedValue({ isServerOwner: false, isServerAdmin: false });

      const caller = createCaller();
      const result = await caller.remove({ userId: "other-1" });

      expect(deleteUserAccount).toHaveBeenCalledWith("other-1");
      expect(result).toEqual({ success: true });
    });

    it("refuses to let an admin delete themselves", async () => {
      const caller = createCaller();

      await expect(caller.remove({ userId: admin.id })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      } satisfies Partial<TRPCError>);

      expect(deleteUserAccount).not.toHaveBeenCalled();
    });

    it("refuses to delete the server owner", async () => {
      getUserRoleFlags.mockResolvedValue({ isServerOwner: true, isServerAdmin: true });

      const caller = createCaller();

      await expect(caller.remove({ userId: "owner-1" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      } satisfies Partial<TRPCError>);

      expect(deleteUserAccount).not.toHaveBeenCalled();
    });
  });
});
