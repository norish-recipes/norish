// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { userProcedures } from "@norish/trpc/routers/user/user";

const mockDb = vi.hoisted(() => ({
  getApiKeysForUser: vi.fn(),
  getUserById: vi.fn(),
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
}));

vi.mock("@norish/db", () => ({
  getApiKeysForUser: mockDb.getApiKeysForUser,
  getUserById: mockDb.getUserById,
  getUserPreferences: mockDb.getUserPreferences,
  updateUserPreferences: mockDb.updateUserPreferences,
  updateUserName: vi.fn(),
  updateUserAvatar: vi.fn(),
  deleteUser: vi.fn(),
  clearUserAvatar: vi.fn(),
  getHouseholdForUser: vi.fn(),
  getUserAllergies: vi.fn(),
  updateUserAllergies: vi.fn(),
  getAllergiesForUsers: vi.fn(),
  getUserLocale: vi.fn(),
  updateUserLocale: vi.fn(),
}));

vi.mock("@norish/trpc/routers/households/emitter", () => ({
  householdEmitter: { emitToHousehold: vi.fn() },
}));

vi.mock("@norish/trpc/connection-manager", () => ({
  emitConnectionInvalidation: vi.fn(),
}));

vi.mock("@norish/db/cached-household", () => ({
  getCachedHouseholdForUser: vi.fn(),
}));

vi.mock("@norish/queue/redis/subscription-multiplexer", () => ({
  getOrCreateMultiplexer: vi.fn(),
}));

vi.mock("@norish/api/startup/media-cleanup", () => ({
  deleteAvatarByFilename: vi.fn(),
}));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    UPLOADS_DIR: "/tmp/uploads",
    MAX_AVATAR_FILE_SIZE: 5 * 1024 * 1024,
  },
}));

vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn(),
}));

describe("userProcedures.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns latest user profile from database instead of stale ctx.user", async () => {
    mockDb.getApiKeysForUser.mockResolvedValue([]);
    mockDb.getUserById.mockResolvedValue({
      id: "user-1",
      email: "fresh@example.com",
      name: "Fresh Name",
      image: "/avatars/user-1.png",
    });

    const caller = userProcedures.createCaller({
      user: {
        id: "user-1",
        email: "stale@example.com",
        name: "Stale Name",
        image: null,
        isServerAdmin: false,
      },
      household: { id: "house-1", users: [{ id: "user-1" }] },
      householdKey: "house-1",
      userIds: ["user-1"],
      householdUserIds: ["user-1"],
      isServerAdmin: false,
      multiplexer: null,
    } as any);

    const result = await caller.get();

    expect(mockDb.getUserById).toHaveBeenCalledWith("user-1");
    expect(result.user.email).toBe("fresh@example.com");
    expect(result.user.name).toBe("Fresh Name");
    expect(result.user.image).toBe("/avatars/user-1.png");
  });
});
