import { describe, expect, it, vi } from "vitest";

import { canAccessHouseholdResource, canAccessResource } from "@norish/auth/permissions";

// Mock getConfig to return test policies
vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    view: "household",
    edit: "household",
    delete: "owner",
  }),
}));

// Mock getHouseholdForUser
vi.mock("@norish/db/repositories/households", () => ({
  getHouseholdForUser: vi.fn().mockImplementation((userId: string) => {
    // Simulate user1 and user2 being in the same household
    if (userId === "user1" || userId === "user2") {
      return Promise.resolve({
        id: "household1",
        users: [{ id: "user1" }, { id: "user2" }],
      });
    }

    // user3 has no household
    return Promise.resolve(null);
  }),
}));

describe("canAccessResource", () => {
  const user1 = "user1";
  const user2 = "user2";
  const user3 = "user3";
  const householdUserIds = ["user1", "user2"];

  describe("owner access", () => {
    it("owner can always view their own resource", async () => {
      const result = await canAccessResource("view", user1, user1, null, false);

      expect(result).toBe(true);
    });

    it("owner can always edit their own resource", async () => {
      const result = await canAccessResource("edit", user1, user1, null, false);

      expect(result).toBe(true);
    });

    it("owner can always delete their own resource", async () => {
      const result = await canAccessResource("delete", user1, user1, null, false);

      expect(result).toBe(true);
    });
  });

  describe("server admin access", () => {
    it("server admin can view any resource", async () => {
      const result = await canAccessResource("view", user3, user1, null, true);

      expect(result).toBe(true);
    });

    it("server admin can edit any resource", async () => {
      const result = await canAccessResource("edit", user3, user1, null, true);

      expect(result).toBe(true);
    });

    it("server admin can delete any resource", async () => {
      const result = await canAccessResource("delete", user3, user1, null, true);

      expect(result).toBe(true);
    });
  });

  describe("household access with policy", () => {
    it("household member can view resource when policy is 'household'", async () => {
      const result = await canAccessResource("view", user2, user1, householdUserIds, false);

      expect(result).toBe(true);
    });

    it("household member can edit resource when policy is 'household'", async () => {
      const result = await canAccessResource("edit", user2, user1, householdUserIds, false);

      expect(result).toBe(true);
    });

    it("household member cannot delete resource when policy is 'owner'", async () => {
      const result = await canAccessResource("delete", user2, user1, householdUserIds, false);

      expect(result).toBe(false);
    });

    it("non-household member cannot view resource", async () => {
      const result = await canAccessResource("view", user3, user1, null, false);

      expect(result).toBe(false);
    });
  });
});

describe("canAccessHouseholdResource", () => {
  it("owner always has access", async () => {
    const result = await canAccessHouseholdResource("user1", "user1");

    expect(result).toBe(true);
  });

  it("household member has access to other member's resource", async () => {
    const result = await canAccessHouseholdResource("user1", "user2");

    expect(result).toBe(true);
  });

  it("non-household member does not have access", async () => {
    const result = await canAccessHouseholdResource("user3", "user1");

    expect(result).toBe(false);
  });
});
