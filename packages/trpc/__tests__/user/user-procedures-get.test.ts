// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { userProcedures } from "@norish/trpc/routers/user/user";

import type { Context } from "../../src/context";

const mockDb = vi.hoisted(() => ({
  getApiKeysForUser: vi.fn(),
  getUserProfile: vi.fn(),
  getUserPreferences: vi.fn(async () => ({})),
  updateUserPreferences: vi.fn(),
}));

vi.mock("@norish/db", () => ({
  getApiKeysForUser: mockDb.getApiKeysForUser,
  getUserProfile: mockDb.getUserProfile,
  getUserPreferences: mockDb.getUserPreferences,
  updateUserPreferences: mockDb.updateUserPreferences,
  updateUserName: vi.fn(),
  updateUserAvatar: vi.fn(),
  clearUserAvatar: vi.fn(),
  getHouseholdForUser: vi.fn(),
  getUserAllergies: vi.fn(),
  updateUserAllergies: vi.fn(),
  getHouseholdAllergyNames: vi.fn(),
  getUserLocale: vi.fn(),
  updateUserLocale: vi.fn(),
}));

vi.mock("@norish/shared-server/realtime/households", () => import("../mocks/realtime/households"));

vi.mock("@norish/shared-server/realtime/connection", () => import("../mocks/realtime/connection"));

vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn(),
}));

vi.mock("@norish/config/env-config-server", () => ({
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

const ctx: Context = {
  user: {
    id: "user-1",
    email: "stale@example.com",
    name: "Stale Name",
    image: "/avatars/stale.png",
    isServerAdmin: false,
    version: 1,
  },
  household: { id: "house-1", name: "My household", users: [{ id: "user-1", name: "" }] },
  connectionId: null,
  operationId: null,
};

describe("userProcedures.get", () => {
  it("returns latest user profile from database instead of stale ctx.user", async () => {
    mockDb.getApiKeysForUser.mockResolvedValue([]);
    mockDb.getUserProfile.mockResolvedValue({
      id: "user-1",
      email: "fresh@example.com",
      name: "Fresh Name",
      image: "/avatars/user-1.png",
    });

    const caller = userProcedures.createCaller(ctx);

    const result = await caller.get();

    expect(mockDb.getUserProfile).toHaveBeenCalledWith("user-1");
    expect(result.user.email).toBe("fresh@example.com");
    expect(result.user.name).toBe("Fresh Name");
    expect(result.user.image).toBe("/avatars/user-1.png");
  });

  it("keeps a cleared avatar when the session still holds its old image", async () => {
    mockDb.getApiKeysForUser.mockResolvedValue([]);
    mockDb.getUserProfile.mockResolvedValue({
      id: "user-1",
      email: "fresh@example.com",
      name: "Fresh Name",
      image: null,
      version: 2,
    });

    const result = await userProcedures.createCaller(ctx).get();

    expect(result.user).toMatchObject({ image: null, version: 2 });
  });
});
