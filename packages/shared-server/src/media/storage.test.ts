// @vitest-environment node

import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

const testUploadsDir = `/tmp/norish-media-delivery-${process.pid}`;

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: testUploadsDir,
    MAX_IMAGE_FILE_SIZE: 10 * 1024 * 1024,
  },
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getMaxVideoFileSize: vi.fn().mockResolvedValue(10 * 1024 * 1024),
}));

vi.mock("@norish/shared-server/logger", () => ({
  serverLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe("media delivery targets", () => {
  afterAll(async () => {
    await rm(testUploadsDir, { recursive: true, force: true });
  });

  it("uses the same deterministic media path on retry", async () => {
    const { saveVideoBytes } = await import("./storage");
    const recipeId = "11111111-1111-4111-8111-111111111111";
    const bytes = Buffer.from("video-bytes");

    const first = await saveVideoBytes(bytes, recipeId, ".mp4", 3, "operation-123");
    const second = await saveVideoBytes(bytes, recipeId, ".mp4", 3, "operation-123");

    expect(second.video).toBe(first.video);
    expect(
      await readFile(path.join(testUploadsDir, "recipes", recipeId, "video-operation-123.mp4"))
    ).toEqual(bytes);
  });
});
