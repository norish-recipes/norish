/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseOIDCClaims, processClaimsForUser } from "@norish/auth/claim-processor";

// Mock dependencies
const mockSetUserAdminStatus = vi.fn();
const mockIsUserServerOwner = vi.fn();
const mockGetUserById = vi.fn();
const mockGetHouseholdForUser = vi.fn();
const mockFindHouseholdByName = vi.fn();
const mockJoinHousehold = vi.fn();
const mockRenameHouseholdOfOne = vi.fn();
const mockPublish = vi.hoisted(() => vi.fn(async () => undefined));
const mockEmitConnectionInvalidation = vi.hoisted(() => vi.fn());
const mockInvalidateHouseholdCache = vi.hoisted(() => vi.fn());

vi.mock("@norish/db/repositories/users", () => ({
  setUserAdminStatus: (...args: unknown[]) => mockSetUserAdminStatus(...args),
  isUserServerOwner: (...args: unknown[]) => mockIsUserServerOwner(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
}));

vi.mock("@norish/db/repositories/households", () => ({
  getHouseholdForUser: (...args: unknown[]) => mockGetHouseholdForUser(...args),
  findHouseholdByName: (...args: unknown[]) => mockFindHouseholdByName(...args),
  joinHousehold: (...args: unknown[]) => mockJoinHousehold(...args),
  renameHouseholdOfOne: (...args: unknown[]) => mockRenameHouseholdOfOne(...args),
  NEW_HOUSEHOLD_NAME: "My household",
}));

vi.mock("@norish/shared-server/cache/household", () => ({
  invalidateHouseholdCacheForUsers: mockInvalidateHouseholdCache,
}));

vi.mock("@norish/shared-server/realtime/connection", () => ({
  emitConnectionInvalidation: mockEmitConnectionInvalidation,
}));

vi.mock("@norish/shared-server/realtime/households", () => ({
  households: { publish: mockPublish },
}));

vi.mock("@norish/shared-server/logger", () => ({
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

    it("should select first household alphabetically regardless of case", () => {
      const profile = { groups: ["norish_household_Zebra", "norish_household_alpha"] };

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
  const HOUSEHOLD_OF_ONE = { id: "own-hh", name: "My household", users: [{ id: userId }] };

  beforeEach(() => {
    mockGetHouseholdForUser.mockResolvedValue(HOUSEHOLD_OF_ONE);
    mockFindHouseholdByName.mockResolvedValue(null);
    mockJoinHousehold.mockResolvedValue({
      joined: { householdId: "household-456", userId, version: 1 },
      leftHouseholdId: HOUSEHOLD_OF_ONE.id,
      memberIds: ["housemate"],
    });
    mockRenameHouseholdOfOne.mockResolvedValue(HOUSEHOLD_OF_ONE.id);
    mockSetUserAdminStatus.mockResolvedValue(undefined);
    mockIsUserServerOwner.mockResolvedValue(false);
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
      expect(mockFindHouseholdByName).not.toHaveBeenCalled();
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

    it("should not revoke admin from the server owner when the admin group is absent", async () => {
      mockIsUserServerOwner.mockResolvedValue(true);
      const profile = { groups: ["users"] };

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockSetUserAdminStatus).not.toHaveBeenCalled();
    });

    it("should still grant admin to the server owner when the admin group is present", async () => {
      mockIsUserServerOwner.mockResolvedValue(true);
      const profile = { groups: ["norish_admin"] };

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenCalledWith(userId, true);
    });

    it("joins a household of one to the claimed household when it exists", async () => {
      const profile = { groups: ["norish_household_smiths"] };

      mockFindHouseholdByName.mockResolvedValue({ id: "hh-123", name: "smiths" });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockFindHouseholdByName).toHaveBeenCalledWith("smiths");
      expect(mockJoinHousehold).toHaveBeenCalledWith(userId, {
        householdId: "hh-123",
        name: "smiths",
      });
      expect(mockRenameHouseholdOfOne).not.toHaveBeenCalled();
    });

    it("names a household of one after the claim when no household has that name", async () => {
      const profile = { groups: ["norish_household_smiths"] };

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockRenameHouseholdOfOne).toHaveBeenCalledWith(userId, "smiths");
      expect(mockInvalidateHouseholdCache).toHaveBeenCalledWith([userId]);
      expect(mockJoinHousehold).not.toHaveBeenCalled();
    });

    it("leaves the name alone when the household gained a member before the rename", async () => {
      mockRenameHouseholdOfOne.mockResolvedValue(null);

      await processClaimsForUser(userId, { groups: ["norish_household_smiths"] }, enabledConfig);

      expect(mockInvalidateHouseholdCache).not.toHaveBeenCalled();
    });

    it("still rescopes the joiner when reading their name fails", async () => {
      mockFindHouseholdByName.mockResolvedValue({ id: "hh-123", name: "smiths" });
      mockGetUserById.mockRejectedValue(new Error("db down"));

      await expect(
        processClaimsForUser(userId, { groups: ["norish_household_smiths"] }, enabledConfig)
      ).rejects.toThrow("db down");

      expect(mockInvalidateHouseholdCache).toHaveBeenCalledWith([userId, "housemate"]);
      expect(mockEmitConnectionInvalidation).toHaveBeenCalledWith(
        userId,
        "household-joined-via-oidc"
      );
    });

    it("leaves an account in a shared household where it is", async () => {
      const profile = { groups: ["norish_household_newhouse"] };

      mockGetHouseholdForUser.mockResolvedValue({
        id: "existing-hh",
        name: "existing",
        users: [{ id: userId }, { id: "housemate" }],
      });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockFindHouseholdByName).not.toHaveBeenCalled();
      expect(mockJoinHousehold).not.toHaveBeenCalled();
      expect(mockRenameHouseholdOfOne).not.toHaveBeenCalled();
    });

    it("keeps a household of one that holds things when joining is refused", async () => {
      const profile = { groups: ["norish_household_smiths"] };

      mockFindHouseholdByName.mockResolvedValue({ id: "hh-123", name: "smiths" });
      mockJoinHousehold.mockResolvedValue({ refused: "holds-things" });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockJoinHousehold).toHaveBeenCalledWith(userId, {
        householdId: "hh-123",
        name: "smiths",
      });
      expect(mockRenameHouseholdOfOne).not.toHaveBeenCalled();
    });

    it("skips a claim naming the default household and takes the next one", async () => {
      const profile = { groups: ["norish_household_my household", "norish_household_smiths"] };

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockFindHouseholdByName).toHaveBeenCalledWith("smiths");
      expect(mockRenameHouseholdOfOne).toHaveBeenCalledWith(userId, "smiths");
    });

    it("ignores a claim naming the default household, which every sign-up gets", async () => {
      const profile = { groups: ["norish_household_my household"] };

      mockFindHouseholdByName.mockResolvedValue({ id: "strangers-hh", name: "My household" });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockFindHouseholdByName).not.toHaveBeenCalled();
      expect(mockJoinHousehold).not.toHaveBeenCalled();
      expect(mockRenameHouseholdOfOne).not.toHaveBeenCalled();
    });

    it("does nothing when the account is already in the claimed household", async () => {
      const profile = { groups: ["norish_household_smiths"] };

      mockFindHouseholdByName.mockResolvedValue({ id: HOUSEHOLD_OF_ONE.id, name: "smiths" });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockJoinHousehold).not.toHaveBeenCalled();
      expect(mockRenameHouseholdOfOne).not.toHaveBeenCalled();
    });

    it("should not attempt to join household when no household claim exists", async () => {
      const profile = { groups: ["norish_admin"] };

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenCalled();
      expect(mockGetHouseholdForUser).not.toHaveBeenCalled();
      expect(mockFindHouseholdByName).not.toHaveBeenCalled();
    });

    it("should process both admin and household in single call", async () => {
      const profile = { groups: ["norish_admin", "norish_household_family"] };

      mockFindHouseholdByName.mockResolvedValue({ id: "family-hh", name: "family" });

      await processClaimsForUser(userId, profile, enabledConfig);

      expect(mockSetUserAdminStatus).toHaveBeenCalledWith(userId, true);
      expect(mockJoinHousehold).toHaveBeenCalledWith(userId, {
        householdId: "family-hh",
        name: "family",
      });
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

      await processClaimsForUser(userId, profile, config);

      expect(mockFindHouseholdByName).toHaveBeenCalledWith("engineering");
    });
  });
});
