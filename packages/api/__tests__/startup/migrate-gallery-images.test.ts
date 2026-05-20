// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockDebug = vi.fn();
const mockError = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

const recipesTable = { table: "recipes" };
const recipeImagesTable = { table: "recipe_images" };

vi.mock("@norish/shared-server/logger", () => ({
  dbLogger: {
    info: mockInfo,
    warn: mockWarn,
    debug: mockDebug,
    error: mockError,
  },
}));

vi.mock("@norish/db/schema", () => ({
  recipes: recipesTable,
  recipeImages: recipeImagesTable,
}));

vi.mock("@norish/db/drizzle", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

describe("migrateGalleryImages", () => {
  let uploadsDir: string;
  let selectResults: unknown[][];
  const updates: Array<{ table: unknown; values: unknown }> = [];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    updates.length = 0;
    selectResults = [];

    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), "norish-migrate-images-"));
    await fs.mkdir(path.join(uploadsDir, "recipes"), { recursive: true });

    vi.doMock("@norish/config/env-config-server", () => ({
      SERVER_CONFIG: {
        UPLOADS_DIR: uploadsDir,
      },
    }));

    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: async () => selectResults.shift() ?? [],
      }),
    }));

    mockUpdate.mockImplementation((table: unknown) => ({
      set: (values: unknown) => ({
        where: async () => {
          updates.push({ table, values });
        },
      }),
    }));
  });

  afterEach(async () => {
    vi.doUnmock("@norish/config/env-config-server");
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  it("skips recipe and gallery URL rewrites when referenced files are missing", async () => {
    selectResults = [
      [
        {
          id: "11111111-1111-1111-1111-111111111111",
          image: "/recipes/images/missing-cover.jpg",
        },
      ],
      [
        {
          id: "image-1",
          recipeId: "11111111-1111-1111-1111-111111111111",
          image: "/recipes/11111111-1111-1111-1111-111111111111/gallery/missing-gallery.jpg",
        },
      ],
    ];

    const { migrateGalleryImages } = await import("@norish/api/startup/migrate-gallery-images");

    await migrateGalleryImages();

    expect(updates).toEqual([]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeId: "11111111-1111-1111-1111-111111111111",
        oldUrl: "/recipes/images/missing-cover.jpg",
        expectedFilename: "missing-cover.jpg",
      }),
      "Skipping thumbnail URL migration because the image file was not found on disk"
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        imageId: "image-1",
        recipeId: "11111111-1111-1111-1111-111111111111",
        oldUrl: "/recipes/11111111-1111-1111-1111-111111111111/gallery/missing-gallery.jpg",
        expectedFilename: "missing-gallery.jpg",
      }),
      "Skipping recipe image URL migration because the image file was not found on disk"
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: 2, uploadsDir }),
      "Recipe image migration skipped database URL updates because referenced files are missing"
    );
  });

  it("rewrites old URLs when the referenced files exist on disk", async () => {
    const recipeId = "22222222-2222-2222-2222-222222222222";

    await fs.mkdir(path.join(uploadsDir, "recipes", recipeId, "gallery"), { recursive: true });
    await fs.writeFile(path.join(uploadsDir, "recipes", recipeId, "cover.jpg"), "cover");
    await fs.writeFile(
      path.join(uploadsDir, "recipes", recipeId, "gallery", "gallery.jpg"),
      "gallery"
    );

    selectResults = [
      [
        {
          id: recipeId,
          image: "/recipes/images/cover.jpg",
        },
      ],
      [
        {
          id: "image-2",
          recipeId,
          image: `/recipes/${recipeId}/gallery/gallery.jpg`,
        },
      ],
    ];

    const { migrateGalleryImages } = await import("@norish/api/startup/migrate-gallery-images");

    await migrateGalleryImages();

    expect(updates).toEqual([
      {
        table: recipesTable,
        values: { image: `/recipes/${recipeId}/cover.jpg` },
      },
      {
        table: recipeImagesTable,
        values: { image: `/recipes/${recipeId}/gallery.jpg` },
      },
    ]);
    expect(mockWarn).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("was not found on disk")
    );
  });
});
