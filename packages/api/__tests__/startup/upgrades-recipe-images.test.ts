// @vitest-environment node
/** Pictures in the layout of 0.15.4 and earlier move into their recipe's folder, URLs and all. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig = { UPLOADS_DIR: "" };
const mockImages: Array<{ id: string; recipeId: string; image: string }> = [];

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: mockConfig }));
vi.mock("@norish/shared-server/logger", () => ({ dbLogger: { warn: vi.fn() } }));
vi.mock("@norish/db/repositories/upgrades", () => ({
  listGalleryImages: vi.fn(() => Promise.resolve(mockImages.map((image) => ({ ...image })))),
  updateGalleryImageUrl: vi.fn((id: string, image: string) => {
    mockImages.find((row) => row.id === id)!.image = image;

    return Promise.resolve();
  }),
}));

const { upgradeRecipeImageLayout } =
  await import("@norish/api/startup/upgrades/before-0-15-5-recipe-images");

const recipeId = "0b6c4f4e-7f39-4a46-9a7e-2d8d3c1f9a11";

describe("the upgrade of recipe pictures from before 0.15.5", () => {
  let recipesDir: string;

  const write = async (file: string) => {
    await fs.mkdir(path.dirname(path.join(recipesDir, file)), { recursive: true });
    await fs.writeFile(path.join(recipesDir, file), file);
  };
  const files = async (dir = "") =>
    (await fs.readdir(path.join(recipesDir, dir), { recursive: true })).sort();

  beforeEach(async () => {
    mockConfig.UPLOADS_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "norish-upgrade-"));
    recipesDir = path.join(mockConfig.UPLOADS_DIR, "recipes");
    mockImages.length = 0;
  });

  afterEach(async () => {
    await fs.rm(mockConfig.UPLOADS_DIR, { recursive: true, force: true });
  });

  it("moves a flat thumbnail and a gallery picture into the recipe's folder and follows with their URLs", async () => {
    await write("thumb.jpg");
    await write(`${recipeId}/gallery/extra.png`);
    mockImages.push(
      { id: "a", recipeId, image: "/recipes/images/thumb.jpg" },
      { id: "b", recipeId, image: `/recipes/${recipeId}/gallery/extra.png` }
    );

    expect(await upgradeRecipeImageLayout()).toBe(2);

    expect(await files()).toEqual([recipeId, `${recipeId}/extra.png`, `${recipeId}/thumb.jpg`]);
    expect(mockImages.map((image) => image.image)).toEqual([
      `/recipes/${recipeId}/thumb.jpg`,
      `/recipes/${recipeId}/extra.png`,
    ]);
  });

  it("keeps the copy already in place, and leaves a URL whose file is gone", async () => {
    await write("thumb.jpg");
    await fs.mkdir(path.join(recipesDir, recipeId), { recursive: true });
    await fs.writeFile(path.join(recipesDir, recipeId, "thumb.jpg"), "in place");
    mockImages.push(
      { id: "a", recipeId, image: "/recipes/images/thumb.jpg" },
      { id: "b", recipeId, image: "/recipes/images/missing.jpg" }
    );

    expect(await upgradeRecipeImageLayout()).toBe(1);

    expect(await fs.readFile(path.join(recipesDir, recipeId, "thumb.jpg"), "utf8")).toBe(
      "in place"
    );
    expect(await files()).toEqual([recipeId, `${recipeId}/thumb.jpg`]);
    expect(mockImages[1]!.image).toBe("/recipes/images/missing.jpg");
  });

  it("does nothing where the layout is today's", async () => {
    await write(`${recipeId}/thumb.jpg`);
    mockImages.push({ id: "a", recipeId, image: `/recipes/${recipeId}/thumb.jpg` });

    expect(await upgradeRecipeImageLayout()).toBe(0);
  });
});
