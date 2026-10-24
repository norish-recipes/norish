// @vitest-environment node
/**
 * The Dish Colour extraction boundary (ADR-0023): an image goes in, one
 * `#rrggbb` colour comes out, and nothing that goes wrong on the way ever
 * escapes as a throw — a recipe write must never fail because its photo
 * would not yield a colour.
 *
 * Extraction runs against real sharp on generated buffers; the URL
 * resolution runs against a real temp uploads dir, mirroring the shapes
 * media/storage.ts writes.
 */
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

const uploadsDir = mkdtempSync(path.join(os.tmpdir(), "dish-color-test-"));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: uploadsDir,
  },
}));

const { getRecipeMediaForDishColor, updateRecipeDishColor } = vi.hoisted(() => ({
  getRecipeMediaForDishColor: vi.fn(),
  updateRecipeDishColor: vi.fn(),
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  getRecipeMediaForDishColor,
  updateRecipeDishColor,
}));

const {
  dishColorForImageUrl,
  extractDishColor,
  refreshDishColorForRecipe,
  withDishColor,
  withDishColorForUpdate,
} = await import("@norish/shared-server/media/dish-color");

const RECIPE_ID = "0f8b7c6d-1e2a-4b3c-8d4e-5f6a7b8c9d0e";

function solidJpeg(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({
    create: { width: 24, height: 24, channels: 3, background: { r, g, b } },
  })
    .jpeg()
    .toBuffer();
}

describe("extractDishColor", () => {
  it("extracts the dominant colour of an image as #rrggbb", async () => {
    const tomatoRed = await solidJpeg(200, 40, 30);
    const color = await extractDishColor(tomatoRed);

    expect(color).toMatch(/^#[0-9a-f]{6}$/);

    // JPEG encoding shifts channels a little; the dominant must still be
    // unmistakably the red the image is made of.
    const r = parseInt(color!.slice(1, 3), 16);
    const g = parseInt(color!.slice(3, 5), 16);
    const b = parseInt(color!.slice(5, 7), 16);

    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(100);
    expect(b).toBeLessThan(100);
  });

  it("returns null rather than throwing for bytes that are not an image", async () => {
    await expect(extractDishColor(Buffer.from("not an image"))).resolves.toBeNull();
  });

  it("lets the food outvote a white plate — the colour is the dish's, not the background's", async () => {
    // Three quarters white worktop, one quarter tomato: a histogram
    // dominant would answer "white"; the dish answers red.
    const plated = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 250, g: 250, b: 250 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 16, height: 16, channels: 3, background: { r: 190, g: 45, b: 35 } },
          })
            .png()
            .toBuffer(),
          top: 8,
          left: 8,
        },
      ])
      .jpeg()
      .toBuffer();

    const color = await extractDishColor(plated);
    const r = parseInt(color!.slice(1, 3), 16);
    const g = parseInt(color!.slice(3, 5), 16);
    const b = parseInt(color!.slice(5, 7), 16);

    expect(r).toBeGreaterThan(g + 40);
    expect(r).toBeGreaterThan(b + 40);
  });

  it("answers neutral for a genuinely neutral photo instead of inventing a hue", async () => {
    const grey = await solidJpeg(128, 128, 128);
    const color = await extractDishColor(grey);
    const r = parseInt(color!.slice(1, 3), 16);
    const g = parseInt(color!.slice(3, 5), 16);
    const b = parseInt(color!.slice(5, 7), 16);

    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
  });
});

describe("dishColorForImageUrl", () => {
  beforeAll(async () => {
    await fs.mkdir(path.join(uploadsDir, "recipes", RECIPE_ID), { recursive: true });
    await fs.writeFile(
      path.join(uploadsDir, "recipes", RECIPE_ID, "stored.jpg"),
      await solidJpeg(30, 160, 60)
    );
  });

  it("resolves a stored recipe-image URL and extracts its colour", async () => {
    const color = await dishColorForImageUrl(`/recipes/${RECIPE_ID}/stored.jpg`);

    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(parseInt(color!.slice(3, 5), 16)).toBeGreaterThan(100);
  });

  it("returns null for a URL whose file does not exist", async () => {
    await expect(dishColorForImageUrl(`/recipes/${RECIPE_ID}/missing.jpg`)).resolves.toBeNull();
  });

  it("returns null for remote and legacy URL shapes rather than fetching", async () => {
    await expect(dishColorForImageUrl("https://example.com/photo.jpg")).resolves.toBeNull();
    await expect(dishColorForImageUrl("/recipes/images/legacy.jpg")).resolves.toBeNull();
    await expect(dishColorForImageUrl(null)).resolves.toBeNull();
    await expect(dishColorForImageUrl(undefined)).resolves.toBeNull();
  });
});

describe("withDishColor", () => {
  it("overwrites a supplied colour — the Dish Colour is derived, never supplied", async () => {
    const dto = await withDishColor({
      images: [{ image: `/recipes/${RECIPE_ID}/stored.jpg`, order: 0 }],
      dishColor: "#123456",
    });

    expect(dto.dishColor).not.toBe("#123456");
    expect(dto.dishColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("yields null for a recipe with no image", async () => {
    await expect(withDishColor({ images: [] })).resolves.toMatchObject({ dishColor: null });
  });
});

describe("withDishColorForUpdate", () => {
  it("recomputes when the update touches the media", async () => {
    const dto = await withDishColorForUpdate({
      images: [{ image: `/recipes/${RECIPE_ID}/stored.jpg`, order: 0 }],
    });

    expect(dto.dishColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("clears the colour when the update removes the image", async () => {
    await expect(withDishColorForUpdate({ images: [] })).resolves.toMatchObject({
      dishColor: null,
    });
  });

  it("says nothing about the colour when the update says nothing about the media", async () => {
    const dto = await withDishColorForUpdate({ name: "Renamed" } as { name: string });

    expect("dishColor" in dto).toBe(false);
  });

  it("drops a colour the payload tried to supply directly", async () => {
    const dto = await withDishColorForUpdate({ dishColor: "#bad000" } as { dishColor: string });

    expect("dishColor" in dto).toBe(false);
  });
});

describe("refreshDishColorForRecipe", () => {
  it("recomputes from the gallery-first hero and stores the result", async () => {
    getRecipeMediaForDishColor.mockResolvedValue({
      galleryImages: [{ image: `/recipes/${RECIPE_ID}/stored.jpg`, order: 0 }],
    });

    await refreshDishColorForRecipe(RECIPE_ID);

    expect(updateRecipeDishColor).toHaveBeenCalledWith(
      RECIPE_ID,
      expect.stringMatching(/^#[0-9a-f]{6}$/)
    );
  });

  it("clears the colour when the recipe no longer leads with any image", async () => {
    getRecipeMediaForDishColor.mockResolvedValue({ galleryImages: [] });

    await refreshDishColorForRecipe(RECIPE_ID);

    expect(updateRecipeDishColor).toHaveBeenCalledWith(RECIPE_ID, null);
  });

  it("writes nothing for a recipe that does not exist", async () => {
    getRecipeMediaForDishColor.mockResolvedValue(null);
    updateRecipeDishColor.mockClear();

    await refreshDishColorForRecipe(RECIPE_ID);

    expect(updateRecipeDishColor).not.toHaveBeenCalled();
  });

  it("never lets a failure escape to the mutation that triggered it", async () => {
    getRecipeMediaForDishColor.mockRejectedValue(new Error("db down"));

    await expect(refreshDishColorForRecipe(RECIPE_ID)).resolves.toBeUndefined();
  });
});
