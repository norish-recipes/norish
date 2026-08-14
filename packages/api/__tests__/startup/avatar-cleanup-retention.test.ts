// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  getAllUserAvatars: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { readdir: fsMocks.readdir, unlink: fsMocks.unlink },
}));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { UPLOADS_DIR: "/tmp/uploads" },
}));

vi.mock("@norish/db/repositories", () => ({
  getAllUserAvatars: dbMocks.getAllUserAvatars,
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  listAllRecipeMediaReferences: vi.fn(),
}));

vi.mock("@norish/db/repositories/steps", () => ({
  listAllStepImageUrls: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({
  schedulerLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { cleanupOrphanedAvatars } from "@norish/api/startup/media-cleanup";

describe("cleanupOrphanedAvatars retention (ADR-0021)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMocks.unlink.mockResolvedValue(undefined);
  });

  it("treats the retained predecessor of a user with an avatar as live, not an orphan", async () => {
    // user-1's DB image points at the -200 file; -100 is the retained predecessor
    fsMocks.readdir.mockResolvedValue(["user-1-200.png", "user-1-100.png"]);
    dbMocks.getAllUserAvatars.mockResolvedValue([
      { userId: "user-1", image: "/avatars/user-1-200.png" },
    ]);

    const result = await cleanupOrphanedAvatars();

    expect(fsMocks.unlink).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 0, errors: 0 });
  });

  it("still sweeps files of users without a stored avatar", async () => {
    fsMocks.readdir.mockResolvedValue(["user-1-100.png", "gone-user-100.png"]);
    dbMocks.getAllUserAvatars.mockResolvedValue([
      { userId: "user-1", image: "/avatars/user-1-100.png" },
    ]);

    const result = await cleanupOrphanedAvatars();

    expect(fsMocks.unlink).toHaveBeenCalledTimes(1);
    expect(fsMocks.unlink).toHaveBeenCalledWith("/tmp/uploads/avatars/gone-user-100.png");
    expect(result).toEqual({ deleted: 1, errors: 0 });
  });
});
