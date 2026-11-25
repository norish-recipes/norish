// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { userProcedures } from "@norish/trpc/routers/user/user";

import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const deleteUserAccount = vi.hoisted(() => vi.fn());

vi.mock("@norish/db", () => import("../mocks/user-repository"));
vi.mock("@norish/auth/account-deletion", () => ({ deleteUserAccount }));
vi.mock("@norish/shared-server/realtime/households", () => import("../mocks/realtime/households"));
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    UPLOADS_DIR: "/tmp",
  },
}));

describe("deleting one's own account", () => {
  beforeEach(() => {
    deleteUserAccount.mockReset();
    deleteUserAccount.mockResolvedValue(undefined);
  });

  it("goes through the routine an admin's removal uses, for a household admin with members too", async () => {
    const admin = createMockUser({ id: "admin-1" });
    const household = createMockHousehold({
      adminUserId: admin.id,
      users: [
        { id: admin.id, name: "Admin" },
        { id: "member-1", name: "Member" },
      ],
    });
    const caller = userProcedures.createCaller(createMockAuthedContext(admin, household) as never);

    expect(await caller.deleteAccount()).toEqual({ success: true });
    expect(deleteUserAccount).toHaveBeenCalledExactlyOnceWith(admin.id);
  });
});
