// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  getApiKeysForUser: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getApiKeysForUser: mockDb.getApiKeysForUser,
  getUserById: mockDb.getUserById,
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

vi.mock("@/server/trpc/routers/households/emitter", () => ({
  householdEmitter: { emitToHousehold: vi.fn() },
}));

vi.mock("@/server/trpc/connection-manager", () => ({
  emitConnectionInvalidation: vi.fn(),
}));

vi.mock("@/server/db/cached-household", () => ({
  getCachedHouseholdForUser: vi.fn(),
}));

vi.mock("@/server/redis/subscription-multiplexer", () => ({
  getOrCreateMultiplexer: vi.fn(),
}));

vi.mock("@/server/startup/media-cleanup", () => ({
  deleteAvatarByFilename: vi.fn(),
}));

vi.mock("@/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: "/tmp/uploads",
    MAX_AVATAR_FILE_SIZE: 5 * 1024 * 1024,
  },
}));

vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn(),
}));

import { userProcedures } from "@/server/trpc/routers/user/user";

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
