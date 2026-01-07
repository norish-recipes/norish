/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { parseOIDCClaims, processClaimsForUser } from "@/server/auth/claim-processor";

// Mock dependencies
const mockSetUserAdminStatus = vi.fn();
const mockGetUserById = vi.fn();
const mockGetHouseholdForUser = vi.fn();
const mockFindOrCreateHouseholdByName = vi.fn();
const mockAddUserToHousehold = vi.fn();
const mockGetUsersByHouseholdId = vi.fn();

vi.mock("@/server/db/repositories/users", () => ({
  setUserAdminStatus: (...args: unknown[]) => mockSetUserAdminStatus(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
}));

vi.mock("@/server/db/repositories/households", () => ({
  getHouseholdForUser: (...args: unknown[]) => mockGetHouseholdForUser(...args),
  findOrCreateHouseholdByName: (...args: unknown[]) => mockFindOrCreateHouseholdByName(...args),
  addUserToHousehold: (...args: unknown[]) => mockAddUserToHousehold(...args),
  getUsersByHouseholdId: (...args: unknown[]) => mockGetUsersByHouseholdId(...args),
}));

vi.mock("@/server/db/cached-household", () => ({
  invalidateHouseholdCacheForUsers: vi.fn(),
}));

vi.mock("@/server/trpc/connection-manager", () => ({
  emitConnectionInvalidation: vi.fn(),
}));

vi.mock("@/server/trpc/routers/households/emitter", () => ({
  householdEmitter: {
    emit: vi.fn(),
    emitToHousehold: vi.fn(),
  },
}));

vi.mock("@/server/logger", () => ({
  authLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  })),
}));

describe("parseOIDCClaims", () => {
  describe("group extraction", () => {
    it("should extract groups from array claim", () => {
      const profile = { groups: ["admin", "users", "norish_admin"] };

      const result = parseOIDCClaims(profile);

      expect(result.rawGroups).toEqual(["admin", "users", "norish_admin"]);
    });

    it("should extract groups from comma-separated string", () => {
      const profile = { groups: "admin,users,norish_admin" };

      const result = parseOIDCClaims(profile);

      expect(result.rawGroups).toEqual(["admin", "users", "norish_admin"]);
    });

    it("should extract groups from space-separated string", () => {
      const profile = { groups: "admin users norish_admin" };

      const result = parseOIDCClaims(profile);

      expect(result.rawGroups).toEqual(["admin", "users", "norish_admin"]);
    });

    it("should handle mixed comma and space separators", () => {
      const profile = { groups: "admin, users norish_admin" };

      const result = parseOIDCClaims(profile);

      expect(result.rawGroups).toEqual(["admin", "users", "norish_admin"]);
    });

    it("should return empty array when groups claim is missing", () => {
      const profile = {};

      const result = parseOIDCClaims(profile);

      expect(result.rawGroups).toEqual([]);
    });

    it("should use custom groups claim name", () => {
      const profile = { roles: ["admin", "norish_admin"] };

      const result = parseOIDCClaims(profile, { groupsClaim: "roles" });

      expect(result.rawGroups).toEqual(["admin", "norish_admin"]);
    });

    it("should filter out non-string values from array", () => {
      const profile = { groups: ["admin", 123, null, "norish_admin", undefined] };

      const result = parseOIDCClaims(profile);

      expect(result.rawGroups).toEqual(["admin", "norish_admin"]);
    });
  });

  describe("admin detection", () => {
    it("should detect admin from default group name", () => {
      const profile = { groups: ["users", "norish_admin"] };

      const result = parseOIDCClaims(profile);

      expect(result.isAdmin).toBe(true);
    });

    it("should not detect admin when group is missing", () => {
      const profile = { groups: ["users", "editors"] };

      const result = parseOIDCClaims(profile);

      expect(result.isAdmin).toBe(false);
    });

    it("should detect admin case-insensitively", () => {
      const profile = { groups: ["NORISH_ADMIN"] };

      const result = parseOIDCClaims(profile);

      expect(result.isAdmin).toBe(true);
    });

    it("should detect admin with mixed case", () => {
      const profile = { groups: ["NoRiSh_AdMiN"] };

      const result = parseOIDCClaims(profile);

      expect(result.isAdmin).toBe(true);
    });

    it("should use custom admin group name", () => {
      const profile = { groups: ["super_admin", "users"] };

      const result = parseOIDCClaims(profile, { adminGroup: "super_admin" });

      expect(result.isAdmin).toBe(true);
    });

    it("should not match partial admin group name", () => {
      const profile = { groups: ["norish_admin_extra", "users"] };

      const result = parseOIDCClaims(profile);

      expect(result.isAdmin).toBe(false);
    });
  });

  describe("household detection", () => {
    it("should extract household name from group with default prefix", () => {
      const profile = { groups: ["users", "norish_household_smiths"] };

      const result = parseOIDCClaims(profile);

      expect(result.householdName).toBe("smiths");
    });

    it("should return null when no household group exists", () => {
      const profile = { groups: ["users", "admin"] };

      const result = parseOIDCClaims(profile);

      expect(result.householdName).toBeNull();
    });

    it("should detect household prefix case-insensitively", () => {
      const profile = { groups: ["NORISH_HOUSEHOLD_family"] };

      const result = parseOIDCClaims(profile);

      expect(result.householdName).toBe("family");
    });

    it("should use custom household prefix", () => {
      const profile = { groups: ["team_cooking_club"] };

      const result = parseOIDCClaims(profile, { householdPrefix: "team_" });

      expect(result.householdName).toBe("cooking_club");
    });

    it("should select first household alphabetically when multiple exist", () => {
      const profile = {
        groups: ["norish_household_zebra", "norish_household_alpha", "norish_household_beta"],
      };

      const result = parseOIDCClaims(profile);

      expect(result.householdName).toBe("alpha");
    });

    it("should ignore household groups with empty name after prefix", () => {
      const profile = { groups: ["norish_household_", "norish_household_valid"] };

      const result = parseOIDCClaims(profile);

      expect(result.householdName).toBe("valid");
    });
  });

  describe("combined scenarios", () => {
    it("should detect both admin and household", () => {
      const profile = { groups: ["norish_admin", "norish_household_family"] };

      const result = parseOIDCClaims(profile);

      expect(result.isAdmin).toBe(true);
      expect(result.householdName).toBe("family");
    });

    it("should work with empty profile", () => {
      const profile = {};

      const result = parseOIDCClaims(profile);

      expect(result.isAdmin).toBe(false);
      expect(result.householdName).toBeNull();
      expect(result.rawGroups).toEqual([]);
    });

    it("should work with all custom config", () => {
      const profile = { roles: ["superuser", "org_engineering"] };
      const config = {
        groupsClaim: "roles",
        adminGroup: "superuser",
        householdPrefix: "org_",
      };

      const result = parseOIDCClaims(profile, config);

      expect(result.isAdmin).toBe(true);
      expect(result.householdName).toBe("engineering");
    });
  });
});

describe("processClaimsForUser", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHouseholdForUser.mockResolvedValue(null);
    mockFindOrCreateHouseholdByName.mockResolvedValue({ id: "household-456", name: "test" });
    mockAddUserToHousehold.mockResolvedValue(undefined);
    mockSetUserAdminStatus.mockResolvedValue(undefined);
    mockGetUsersByHouseholdId.mockResolvedValue([]);
    mockGetUserById.mockResolvedValue({
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
      image: null,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("when claim mapping is disabled", () => {
    it("should skip processing when enabled is false (default)", async () => {
      const profile = { groups: ["norish_admin", "norish_household_family"] };

      await processClaimsForUser(userId, profile);

      expect(mockSetUserAdminStatus).not.toHaveBeenCalled();
      expect(mockGetHouseholdForUser).not.toHaveBeenCalled();
      expect(mockFindOrCreateHouseholdByName).not.toHaveBeenCalled();
    });

    it("should skip processing when enabled is explicitly false", async () => {
      const profile = { groups: ["norish_admin", "norish_household_family"] };

      await processClaimsForUser(userId, profile, { enabled: false });

      expect(mockSetUserAdminStatus).not.toHaveBeenCalled();
    });
  });

  describe("when claim mapping is enabled", () => {
    const enabledConfig = { enabled: true };

    it("should set admin status to true when admin group is present", async () => {
      const profile = { groups: ["norish_admin"] };

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenCalledWith(userId, true);
    });

    it("should set admin status to false when admin group is absent", async () => {
      const profile = { groups: ["users"] };

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenCalledWith(userId, false);
    });

    it("should revoke admin on subsequent login without admin group", async () => {
      // First login with admin
      const profile1 = { groups: ["norish_admin"] };

      await processClaimsForUser(userId, profile1, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenLastCalledWith(userId, true);

      // Second login without admin
      const profile2 = { groups: ["users"] };

      await processClaimsForUser(userId, profile2, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenLastCalledWith(userId, false);
    });

    it("should join user to household when claim present and user has no household", async () => {
      const profile = { groups: ["norish_household_smiths"] };

      mockGetHouseholdForUser.mockResolvedValue(null);
      mockFindOrCreateHouseholdByName.mockResolvedValue({ id: "hh-123", name: "smiths" });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockGetHouseholdForUser).toHaveBeenCalledWith(userId);
      expect(mockFindOrCreateHouseholdByName).toHaveBeenCalledWith("smiths", userId);
      expect(mockAddUserToHousehold).toHaveBeenCalledWith({ householdId: "hh-123", userId });
    });

    it("should not join household when user already has one", async () => {
      const profile = { groups: ["norish_household_newhouse"] };

      mockGetHouseholdForUser.mockResolvedValue({ id: "existing-hh", name: "existing" });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockGetHouseholdForUser).toHaveBeenCalledWith(userId);
      expect(mockFindOrCreateHouseholdByName).not.toHaveBeenCalled();
      expect(mockAddUserToHousehold).not.toHaveBeenCalled();
    });

    it("should not attempt to join household when no household claim exists", async () => {
      const profile = { groups: ["norish_admin"] };

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenCalled();
      expect(mockGetHouseholdForUser).not.toHaveBeenCalled();
      expect(mockFindOrCreateHouseholdByName).not.toHaveBeenCalled();
    });

    it("should process both admin and household in single call", async () => {
      const profile = { groups: ["norish_admin", "norish_household_family"] };

      mockGetHouseholdForUser.mockResolvedValue(null);
      mockFindOrCreateHouseholdByName.mockResolvedValue({ id: "family-hh", name: "family" });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenCalledWith(userId, true);
      expect(mockFindOrCreateHouseholdByName).toHaveBeenCalledWith("family", userId);
      expect(mockAddUserToHousehold).toHaveBeenCalledWith({ householdId: "family-hh", userId });
    });
  });

  describe("with custom config", () => {
    it("should use custom groups claim", async () => {
      const profile = { roles: ["superadmin"] };
      const config = { enabled: true, groupsClaim: "roles", adminGroup: "superadmin" };

      await processClaimsForUser(userId, profile, config);

      expect(mockSetUserAdminStatus).toHaveBeenCalledWith(userId, true);
    });

    it("should use custom household prefix", async () => {
      const profile = { groups: ["team_engineering"] };
      const config = { enabled: true, householdPrefix: "team_" };

      mockGetHouseholdForUser.mockResolvedValue(null);
      mockFindOrCreateHouseholdByName.mockResolvedValue({ id: "eng-hh", name: "engineering" });

      await processClaimsForUser(userId, profile, config);

      expect(mockFindOrCreateHouseholdByName).toHaveBeenCalledWith("engineering", userId);
    });
  });
});
