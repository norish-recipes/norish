// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { userProcedures } from "@norish/trpc/routers/user/user";

import type { Context } from "../../src/context";

const mockDb = vi.hoisted(() => ({
  getUserById: vi.fn(),
  updateUserAvatar: vi.fn(),
  clearUserAvatar: vi.fn(),
}));

const mockAvatarCleanup = vi.hoisted(() => ({
  deleteAvatarByFilename: vi.fn(),
  sweepUserAvatars: vi.fn(),
}));

const mockEmitter = vi.hoisted(() => ({
  emitToHousehold: vi.fn(),
}));

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@norish/db", () => ({
  getApiKeysForUser: vi.fn(),
  getUserById: mockDb.getUserById,
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
  updateUserName: vi.fn(),
  updateUserAvatar: mockDb.updateUserAvatar,
  deleteUser: vi.fn(),
  clearUserAvatar: mockDb.clearUserAvatar,
  getHouseholdForUser: vi.fn(),
  getUserAllergies: vi.fn(),
  updateUserAllergies: vi.fn(),
  getAllergiesForUsers: vi.fn(),
}));

vi.mock("@norish/trpc/routers/households/emitter", () => ({
  householdEmitter: mockEmitter,
}));

vi.mock("@norish/trpc/connection-manager", () => ({
  emitConnectionInvalidation: vi.fn(),
}));

vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn(),
}));

vi.mock("@norish/shared-server/redis/subscription-multiplexer", () => ({
  getOrCreateMultiplexer: vi.fn(),
}));

vi.mock("@norish/shared-server/media/avatar-cleanup", () => mockAvatarCleanup);

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    UPLOADS_DIR: "/tmp/uploads",
    MAX_AVATAR_FILE_SIZE: 5 * 1024 * 1024,
  },
}));

vi.mock("fs/promises", () => mockFs);

const HOUSEHOLD: Context["household"] = {
  id: "house-1",
  name: "Test House",
  users: [
    { id: "user-1", name: "User One" },
    { id: "user-2", name: "User Two" },
  ],
};

function createCaller(household: Context["household"] = HOUSEHOLD) {
  const ctx: Context = {
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "User One",
      image: "/avatars/stale-from-session.png",
      version: 3,
      isServerAdmin: false,
    },
    household,
    connectionId: null,
    multiplexer: null,
    operationId: null,
  };

  return userProcedures.createCaller(ctx);
}

function buildUploadInput(version = 3) {
  const formData = new FormData();

  formData.append(
    "file",
    new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" })
  );
  formData.append("version", String(version));

  return formData;
}

describe("avatar caching contract (ADR-0021)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1755000000000);

    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockAvatarCleanup.sweepUserAvatars.mockResolvedValue(undefined);
    mockAvatarCleanup.deleteAvatarByFilename.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("uploadAvatar", () => {
    it("mints a versioned filename and stores it as the user's image", async () => {
      mockDb.getUserById
        .mockResolvedValueOnce({ id: "user-1", image: "/avatars/user-1-100.png", version: 3 })
        .mockResolvedValueOnce({ id: "user-1", image: "/avatars/user-1-1755000000000.png" });
      mockDb.updateUserAvatar.mockResolvedValue({ stale: false });

      const result = await createCaller().uploadAvatar(buildUploadInput());

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/tmp/uploads/avatars/user-1-1755000000000.png",
        expect.anything()
      );
      expect(mockDb.updateUserAvatar).toHaveBeenCalledWith(
        "user-1",
        "/avatars/user-1-1755000000000.png",
        3
      );
    });

    it("mints a different filename on each upload", async () => {
      mockDb.getUserById.mockResolvedValue({ id: "user-1", image: null, version: 3 });
      mockDb.updateUserAvatar.mockResolvedValue({ stale: false });

      const nowSpy = vi.spyOn(Date, "now");

      nowSpy.mockReturnValue(1755000000001);
      await createCaller().uploadAvatar(buildUploadInput());
      nowSpy.mockReturnValue(1755000000002);
      await createCaller().uploadAvatar(buildUploadInput());

      const [firstPath] = mockFs.writeFile.mock.calls[0]!;
      const [secondPath] = mockFs.writeFile.mock.calls[1]!;

      expect(firstPath).not.toBe(secondPath);
    });

    it("retains the immediate predecessor and sweeps older files after a successful update", async () => {
      mockDb.getUserById
        .mockResolvedValueOnce({ id: "user-1", image: "/avatars/user-1-100.png", version: 3 })
        .mockResolvedValueOnce({ id: "user-1", image: "/avatars/user-1-1755000000000.png" });
      mockDb.updateUserAvatar.mockResolvedValue({ stale: false });

      await createCaller().uploadAvatar(buildUploadInput());

      expect(mockAvatarCleanup.sweepUserAvatars).toHaveBeenCalledWith("user-1", [
        "user-1-1755000000000.png",
        "user-1-100.png",
      ]);
    });

    it("keeps only the new file when the user had no previous /avatars/ image", async () => {
      mockDb.getUserById
        .mockResolvedValueOnce({
          id: "user-1",
          image: "https://oauth.example/photo.jpg",
          version: 3,
        })
        .mockResolvedValueOnce({ id: "user-1", image: "/avatars/user-1-1755000000000.png" });
      mockDb.updateUserAvatar.mockResolvedValue({ stale: false });

      await createCaller().uploadAvatar(buildUploadInput());

      expect(mockAvatarCleanup.sweepUserAvatars).toHaveBeenCalledWith("user-1", [
        "user-1-1755000000000.png",
      ]);
    });

    it("emits memberProfileUpdated to the household after a successful upload", async () => {
      mockDb.getUserById
        .mockResolvedValueOnce({ id: "user-1", image: null, version: 3 })
        .mockResolvedValueOnce({ id: "user-1", image: "/avatars/user-1-1755000000000.png" });
      mockDb.updateUserAvatar.mockResolvedValue({ stale: false });

      await createCaller().uploadAvatar(buildUploadInput());

      expect(mockEmitter.emitToHousehold).toHaveBeenCalledWith("house-1", "memberProfileUpdated", {
        userId: "user-1",
        image: "/avatars/user-1-1755000000000.png",
      });
    });

    it("skips the emit when the user has no household", async () => {
      mockDb.getUserById
        .mockResolvedValueOnce({ id: "user-1", image: null, version: 3 })
        .mockResolvedValueOnce({ id: "user-1", image: "/avatars/user-1-1755000000000.png" });
      mockDb.updateUserAvatar.mockResolvedValue({ stale: false });

      const result = await createCaller(null).uploadAvatar(buildUploadInput());

      expect(result.success).toBe(true);
      expect(mockEmitter.emitToHousehold).not.toHaveBeenCalled();
    });

    it("deletes the just-written file and sweeps nothing on a stale upload", async () => {
      mockDb.getUserById.mockResolvedValueOnce({
        id: "user-1",
        image: "/avatars/user-1-100.png",
        version: 4,
      });
      mockDb.updateUserAvatar.mockResolvedValue({ stale: true });

      const result = await createCaller().uploadAvatar(buildUploadInput(3));

      expect(result).toMatchObject({ success: true, stale: true });
      expect(mockAvatarCleanup.deleteAvatarByFilename).toHaveBeenCalledWith(
        "user-1-1755000000000.png"
      );
      expect(mockAvatarCleanup.sweepUserAvatars).not.toHaveBeenCalled();
      expect(mockEmitter.emitToHousehold).not.toHaveBeenCalled();
    });
  });

  describe("deleteAvatar", () => {
    it("sweeps every avatar file and emits memberProfileUpdated with a null image", async () => {
      mockDb.clearUserAvatar.mockResolvedValue({ stale: false });
      mockDb.getUserById.mockResolvedValue({ id: "user-1", image: null });

      const result = await createCaller().deleteAvatar({ version: 3 });

      expect(result.success).toBe(true);
      expect(mockAvatarCleanup.sweepUserAvatars).toHaveBeenCalledWith("user-1");
      expect(mockEmitter.emitToHousehold).toHaveBeenCalledWith("house-1", "memberProfileUpdated", {
        userId: "user-1",
        image: null,
      });
    });

    it("does nothing on a stale delete", async () => {
      mockDb.clearUserAvatar.mockResolvedValue({ stale: true });

      const result = await createCaller().deleteAvatar({ version: 3 });

      expect(result).toMatchObject({ success: true, stale: true });
      expect(mockAvatarCleanup.sweepUserAvatars).not.toHaveBeenCalled();
      expect(mockEmitter.emitToHousehold).not.toHaveBeenCalled();
    });
  });
});
