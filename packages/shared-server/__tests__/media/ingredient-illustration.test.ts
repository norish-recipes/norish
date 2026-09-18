// @vitest-environment node
/**
 * Ingredient Illustration storage (ADR-0037): every picture becomes a 512px
 * WebP square under a filename no earlier picture used, and replacing one
 * keeps exactly its immediate predecessor on disk (the ADR-0021 rule). Runs
 * against real sharp and a temp uploads dir, beside the Generated Image test.
 */
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadsDir = mkdtempSync(path.join(os.tmpdir(), "ingredient-illustration-test-"));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: uploadsDir,
    MAX_IMAGE_FILE_SIZE: 5 * 1024 * 1024,
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
  },
}));

const repository = vi.hoisted(() => ({ setIngredientImage: vi.fn() }));

vi.mock("@norish/db/repositories/ingredient-pictures", () => repository);

vi.mock("@norish/shared-server/logger", () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { serverLogger: logger, createLogger: () => logger };
});

const {
  IngredientIllustrationInputError,
  removeIngredientIllustration,
  storeIngredientIllustration,
} = await import("@norish/shared-server/media/ingredient-illustration");

const ID = "7d5b3c1e-2a4f-4c6d-8e9f-0a1b2c3d4e5f";
const OTHER_ID = "11111111-2222-4333-8444-555555555555";

function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: "#3a7d2c" } })
    .png()
    .toBuffer();
}

function dir(): string {
  return path.join(uploadsDir, "ingredient-images");
}

async function files(): Promise<string[]> {
  return (await fs.readdir(dir()).catch(() => [])).sort();
}

function fileOf(url: string): string {
  return path.join(uploadsDir, url.replace(/^\//, ""));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await fs.rm(dir(), { recursive: true, force: true });
});

describe("storeIngredientIllustration", () => {
  it("stores a 512px WebP square and points the entry at it", async () => {
    repository.setIngredientImage.mockResolvedValue({ previousImageUrl: null });

    const url = await storeIngredientIllustration(ID, await png(900, 600));

    expect(url).toMatch(new RegExp(`^/ingredient-images/${ID}-[a-z0-9]+\\.webp$`));
    expect(repository.setIngredientImage).toHaveBeenCalledWith(ID, url);

    const metadata = await sharp(await fs.readFile(fileOf(url!))).metadata();

    expect(metadata).toMatchObject({ format: "webp", width: 512, height: 512 });
  });

  it("keeps the immediate predecessor and sweeps older pictures, never another entry's", async () => {
    repository.setIngredientImage.mockResolvedValueOnce({ previousImageUrl: null });
    const first = await storeIngredientIllustration(ID, await png(64, 64));

    repository.setIngredientImage.mockResolvedValueOnce({ previousImageUrl: first });
    const second = await storeIngredientIllustration(ID, await png(64, 64));

    repository.setIngredientImage.mockResolvedValueOnce({ previousImageUrl: null });
    const other = await storeIngredientIllustration(OTHER_ID, await png(64, 64), {});

    repository.setIngredientImage.mockResolvedValueOnce({ previousImageUrl: second });
    const third = await storeIngredientIllustration(ID, await png(64, 64));

    expect(await files()).toEqual(
      [second!, third!, other!].map((url) => path.basename(url)).sort()
    );
  });

  it("leaves nothing behind when the entry was deleted meanwhile", async () => {
    repository.setIngredientImage.mockResolvedValue(undefined);

    expect(await storeIngredientIllustration(ID, await png(64, 64))).toBeNull();
    expect(await files()).toEqual([]);
  });

  it("refuses bytes that are not an image, writing nothing", async () => {
    await expect(storeIngredientIllustration(ID, Buffer.alloc(200, 1))).rejects.toThrow(
      /not a valid image/
    );
    await expect(storeIngredientIllustration(ID, Buffer.alloc(200, 1))).rejects.toBeInstanceOf(
      IngredientIllustrationInputError
    );
    expect(repository.setIngredientImage).not.toHaveBeenCalled();
  });
});

describe("removeIngredientIllustration", () => {
  it("clears the entry and sweeps every file it had", async () => {
    repository.setIngredientImage.mockResolvedValue({ previousImageUrl: null });
    await storeIngredientIllustration(ID, await png(64, 64));

    expect(await removeIngredientIllustration(ID)).toBe(true);
    expect(repository.setIngredientImage).toHaveBeenLastCalledWith(ID, null);
    expect(await files()).toEqual([]);
  });

  it("reports a missing entry", async () => {
    repository.setIngredientImage.mockResolvedValue(undefined);

    expect(await removeIngredientIllustration(ID)).toBe(false);
  });
});
