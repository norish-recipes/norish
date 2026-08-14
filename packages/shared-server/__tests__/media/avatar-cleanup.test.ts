// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { readdir: fsMocks.readdir, unlink: fsMocks.unlink },
  readdir: fsMocks.readdir,
  unlink: fsMocks.unlink,
}));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: { UPLOADS_DIR: "/tmp/uploads" },
}));

vi.mock("@norish/shared-server/logger", () => ({
  schedulerLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sweepUserAvatars } from "@norish/shared-server/media/avatar-cleanup";

describe("sweepUserAvatars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMocks.unlink.mockResolvedValue(undefined);
  });

  it("deletes all avatar files for the user when nothing is kept", async () => {
    fsMocks.readdir.mockResolvedValue([
      "user-1-100.png",
      "user-1-200.webp",
      "user-1.jpg",
      "user-2-100.png",
    ]);

    await sweepUserAvatars("user-1");

    const deleted = fsMocks.unlink.mock.calls.map(([p]: [string]) => p);

    expect(deleted).toEqual([
      "/tmp/uploads/avatars/user-1-100.png",
      "/tmp/uploads/avatars/user-1-200.webp",
      "/tmp/uploads/avatars/user-1.jpg",
    ]);
  });

  it("retains the kept filenames (current upload and its predecessor)", async () => {
    fsMocks.readdir.mockResolvedValue(["user-1-100.png", "user-1-200.png", "user-1-300.png"]);

    await sweepUserAvatars("user-1", ["user-1-300.png", "user-1-200.png"]);

    const deleted = fsMocks.unlink.mock.calls.map(([p]: [string]) => p);

    expect(deleted).toEqual(["/tmp/uploads/avatars/user-1-100.png"]);
  });

  it("never touches other users' files", async () => {
    fsMocks.readdir.mockResolvedValue(["user-2-100.png", "user-10-100.png"]);

    await sweepUserAvatars("user-1");

    expect(fsMocks.unlink).not.toHaveBeenCalled();
  });

  it("swallows a missing avatars directory", async () => {
    fsMocks.readdir.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    await expect(sweepUserAvatars("user-1")).resolves.toBeUndefined();
    expect(fsMocks.unlink).not.toHaveBeenCalled();
  });

  it("continues past individual unlink failures", async () => {
    fsMocks.readdir.mockResolvedValue(["user-1-100.png", "user-1-200.png"]);
    fsMocks.unlink.mockRejectedValueOnce(new Error("EACCES"));

    await sweepUserAvatars("user-1");

    expect(fsMocks.unlink).toHaveBeenCalledTimes(2);
  });
});
