// @vitest-environment node
import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { migrateGalleryImages } from "@norish/api/startup/migrate-gallery-images";
import { SERVER_CONFIG } from "@norish/config/env-config-server";

// The module under test captures UPLOADS_DIR at import time, so the config is
// mocked once for the whole file and every test works inside that directory.
// Re-mocking per test (resetModules + dynamic import) re-evaluated the heavy
// import chain inside each test's timeout budget, which blew up under a fully
// parallel run — and the abandoned run then drained the shared fixture queue
// of the next test. Fixtures are therefore keyed by table, never consumed.
const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  recipesTable: { table: "recipes" },
  recipeImagesTable: { table: "recipe_images" },
}));

const { warn: mockWarn, recipesTable, recipeImagesTable } = mocks;

vi.mock("@norish/shared-server/logger", () => ({
  dbLogger: {
    info: mocks.info,
    warn: mocks.warn,
    debug: mocks.debug,
    error: mocks.error,
  },
}));

vi.mock("@norish/db/schema", () => ({
  recipes: mocks.recipesTable,
  recipeImages: mocks.recipeImagesTable,
}));

vi.mock("@norish/db/drizzle", () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
  },
}));

vi.mock("@norish/config/env-config-server", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  return {
    SERVER_CONFIG: {
      MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
      UPLOADS_DIR: mkdtempSync(join(tmpdir(), "norish-migrate-images-")),
    },
  };
});

describe("migrateGalleryImages", () => {
  const uploadsDir = SERVER_CONFIG.UPLOADS_DIR;
  const recipesDir = path.join(uploadsDir, "recipes");
  let selectResultsByTable: Map<unknown, unknown[]>;
  const updates: Array<{ table: unknown; values: unknown }> = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    updates.length = 0;
    selectResultsByTable = new Map();

    await fs.rm(recipesDir, { recursive: true, force: true });
    await fs.mkdir(recipesDir, { recursive: true });

    mocks.select.mockImplementation(() => ({
      from: (table: unknown) => ({
        where: async () => selectResultsByTable.get(table) ?? [],
      }),
    }));

    mocks.update.mockImplementation((table: unknown) => ({
      set: (values: unknown) => ({
        where: async () => {
          updates.push({ table, values });
        },
      }),
    }));
  });

  afterAll(async () => {
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  it("skips recipe and gallery URL rewrites when referenced files are missing", async () => {
    selectResultsByTable.set(recipesTable, [
      {
        id: "11111111-1111-1111-1111-111111111111",
        image: "/recipes/images/missing-cover.jpg",
      },
    ]);
    selectResultsByTable.set(recipeImagesTable, [
      {
        id: "image-1",
        recipeId: "11111111-1111-1111-1111-111111111111",
        image: "/recipes/11111111-1111-1111-1111-111111111111/gallery/missing-gallery.jpg",
      },
    ]);

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

    await fs.mkdir(path.join(recipesDir, recipeId, "gallery"), { recursive: true });
    await fs.writeFile(path.join(recipesDir, recipeId, "cover.jpg"), "cover");
    await fs.writeFile(path.join(recipesDir, recipeId, "gallery", "gallery.jpg"), "gallery");

    selectResultsByTable.set(recipesTable, [
      {
        id: recipeId,
        image: "/recipes/images/cover.jpg",
      },
    ]);
    selectResultsByTable.set(recipeImagesTable, [
      {
        id: "image-2",
        recipeId,
        image: `/recipes/${recipeId}/gallery/gallery.jpg`,
      },
    ]);

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
