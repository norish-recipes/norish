import { describe, expect, it, vi } from "vitest";

import { assertHouseholdAccess, canAccessResource } from "@norish/auth/permissions";

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    view: "household",
    edit: "household",
    delete: "owner",
  }),
}));

// user1 and user2 share household1; user3 is in household3 on their own.
const MEMBERS: Record<string, string[]> = {
  household1: ["user1", "user2"],
  household3: ["user3"],
};

vi.mock("@norish/db/repositories/households", () => ({
  isHouseholdMember: vi.fn(async (householdId: string, userId: string) =>
    (MEMBERS[householdId] ?? []).includes(userId)
  ),
}));

const viewer = (userId: string, householdId: string, isServerAdmin = false) => ({
  userId,
  householdId,
  isServerAdmin,
});

describe("canAccessResource", () => {
  describe("owner access", () => {
    it.each(["view", "edit", "delete"] as const)(
      "owner can always %s their own resource",
      async (action) => {
        expect(await canAccessResource(action, viewer("user1", "household1"), "user1")).toBe(true);
      }
    );
  });

  describe("server admin access", () => {
    it.each(["view", "edit", "delete"] as const)(
      "server admin can %s any resource",
      async (action) => {
        expect(await canAccessResource(action, viewer("user3", "household3", true), "user1")).toBe(
          true
        );
      }
    );
  });

  describe("household access with policy", () => {
    it("household member can view resource when policy is 'household'", async () => {
      expect(await canAccessResource("view", viewer("user2", "household1"), "user1")).toBe(true);
    });

    it("household member can edit resource when policy is 'household'", async () => {
      expect(await canAccessResource("edit", viewer("user2", "household1"), "user1")).toBe(true);
    });

    it("household member cannot delete resource when policy is 'owner'", async () => {
      expect(await canAccessResource("delete", viewer("user2", "household1"), "user1")).toBe(false);
    });

    it("someone in another household cannot view resource", async () => {
      expect(await canAccessResource("view", viewer("user3", "household3"), "user1")).toBe(false);
    });
  });
});

describe("assertHouseholdAccess", () => {
  it("lets a member reach their own and a housemate's rows", async () => {
    await expect(assertHouseholdAccess("household1", "user1")).resolves.toBeUndefined();
    await expect(assertHouseholdAccess("household1", "user2")).resolves.toBeUndefined();
  });

  it("refuses a row owned outside the household", async () => {
    await expect(assertHouseholdAccess("household3", "user1")).rejects.toThrow("FORBIDDEN");
  });
});
