// @vitest-environment node
/** A deletion removes a file only from the folder of the recipe whose row or request names it. */
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const uploadsDir = mkdtempSync(path.join(os.tmpdir(), "recipe-media-files-test-"));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: uploadsDir,
    MAX_IMAGE_FILE_SIZE: 5 * 1024 * 1024,
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
  },
}));

const { deleteImageByUrl, deleteStepImageByUrl, deleteVideoByUrl } =
  await import("@norish/shared-server/media/storage");

const OWNER = "0c7fcd0e-4f1a-4f5f-9a5e-92b1a54d21aa";
const OTHER = "1d8fcd0e-4f1a-4f5f-9a5e-92b1a54d21bb";

async function stored(relative: string): Promise<string> {
  const file = path.join(uploadsDir, relative);

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, "x");

  return file;
}

const exists = (file: string) =>
  fs
    .access(file)
    .then(() => true)
    .catch(() => false);

describe("recipe media deletion", () => {
  it("keeps another recipe's file whatever the URL says", async () => {
    const image = await stored(`recipes/${OWNER}/a.jpg`);
    const step = await stored(`recipes/${OWNER}/steps/a.jpg`);
    const video = await stored(`recipes/${OWNER}/video-1.mp4`);

    await expect(deleteImageByUrl(`/recipes/${OWNER}/a.jpg`, OTHER)).rejects.toThrow();
    await expect(deleteStepImageByUrl(`/recipes/${OWNER}/steps/a.jpg`, OTHER)).rejects.toThrow();
    await expect(deleteVideoByUrl(`/recipes/${OWNER}/video-1.mp4`, OTHER)).rejects.toThrow();

    expect([await exists(image), await exists(step), await exists(video)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("deletes the recipe's own file", async () => {
    const image = await stored(`recipes/${OWNER}/b.jpg`);

    await deleteImageByUrl(`/recipes/${OWNER}/b.jpg`, OWNER);

    expect(await exists(image)).toBe(false);
  });
});
