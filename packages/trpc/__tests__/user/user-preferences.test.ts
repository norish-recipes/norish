// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { userProcedures } from "@norish/trpc/routers/user/user";

import type { Context } from "../../src/context";

const mockDb = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
  setUserDevicePreferences: vi.fn(),
}));

vi.mock("@norish/db", () => ({
  getApiKeysForUser: vi.fn(),
  getUserById: mockDb.getUserById,
  getUserPreferences: mockDb.getUserPreferences,
  updateUserPreferences: mockDb.updateUserPreferences,
  setUserDevicePreferences: mockDb.setUserDevicePreferences,
  updateUserName: vi.fn(),
  updateUserAvatar: vi.fn(),
  clearUserAvatar: vi.fn(),
  getHouseholdForUser: vi.fn(),
  getUserAllergies: vi.fn(),
  updateUserAllergies: vi.fn(),
  getAllergiesForUsers: vi.fn(),
}));

vi.mock("@norish/shared-server/realtime/households", () => import("../mocks/realtime/households"));

vi.mock("@norish/shared-server/realtime/connection", () => import("../mocks/realtime/connection"));

vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@norish/shared-server/media/avatar-cleanup", () => ({
  deleteAvatarByFilename: vi.fn(),
  sweepUserAvatars: vi.fn(),
}));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    UPLOADS_DIR: "/tmp/uploads",
    MAX_AVATAR_FILE_SIZE: 5 * 1024 * 1024,
  },
}));

function createCaller(signedIn = true) {
  const ctx: Context = {
    user: signedIn
      ? {
          id: "user-1",
          email: "user@example.com",
          name: "User One",
          image: null,
          version: 3,
          isServerAdmin: false,
        }
      : null,
    household: null,
    connectionId: null,
    operationId: null,
  };

  return userProcedures.createCaller(ctx);
}

describe("user preference procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getUserPreferences.mockResolvedValue({
      locale: "en",
      phone: { groceryViewMode: "recipe" },
    });
    mockDb.getUserById.mockResolvedValue({ id: "user-1", version: 4 });
    mockDb.updateUserPreferences.mockResolvedValue({ stale: false });
    mockDb.setUserDevicePreferences.mockResolvedValue(undefined);
  });

  describe("updatePreferences", () => {
    it("writes only the keys it was given, so it can never put back a stale device block", async () => {
      const result = await createCaller().updatePreferences({
        version: 3,
        preferences: { locale: "nl" },
      });

      expect(mockDb.updateUserPreferences).toHaveBeenCalledWith("user-1", { locale: "nl" }, 3);
      expect(result).toEqual({ success: true, preferences: { locale: "nl" }, version: 4 });
    });

    it("answers a stale version with the stored language, never a device block", async () => {
      mockDb.updateUserPreferences.mockResolvedValue({ stale: true });

      const result = await createCaller().updatePreferences({
        version: 2,
        preferences: { locale: "nl" },
      });

      expect(result).toEqual({
        success: true,
        stale: true,
        preferences: { locale: "en" },
        version: 2,
      });
    });
  });

  describe("setDevicePreferences", () => {
    it("merges the choices into the named kind", async () => {
      await createCaller().setDevicePreferences({
        kind: "desktop",
        preferences: { groceryViewMode: "recipe", groceryGroupSimilar: false },
      });

      expect(mockDb.setUserDevicePreferences).toHaveBeenCalledWith("user-1", "desktop", {
        groceryViewMode: "recipe",
        groceryGroupSimilar: false,
      });
      expect(mockDb.updateUserPreferences).not.toHaveBeenCalled();
    });

    it("rejects a value outside the defined set", async () => {
      // What a broken client might send, past the input's own type.
      const input: unknown = { kind: "phone", preferences: { groceryViewMode: "aisle" } };

      await expect(createCaller().setDevicePreferences(input as never)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mockDb.setUserDevicePreferences).not.toHaveBeenCalled();
    });

    it("refuses a signed-out request", async () => {
      await expect(
        createCaller(false).setDevicePreferences({
          kind: "phone",
          preferences: { groceryViewMode: "recipe" },
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(mockDb.setUserDevicePreferences).not.toHaveBeenCalled();
    });
  });
});
