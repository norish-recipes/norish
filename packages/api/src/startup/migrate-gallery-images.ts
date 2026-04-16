import fs from "fs/promises";
import path from "path";
import { eq, like, or } from "drizzle-orm";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { db } from "@norish/db/drizzle";
import { recipeImages, recipes } from "@norish/db/schema";
import { dbLogger as log } from "@norish/shared-server/logger";

const RECIPES_DIR = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes");

// Old URL pattern for thumbnails: /recipes/images/{filename}
const OLD_THUMBNAIL_URL_PATTERN = /^\/recipes\/images\/([^/]+)$/;
// Old URL pattern for gallery: /recipes/{recipeId}/gallery/{filename}
const OLD_GALLERY_URL_PATTERN = /^\/recipes\/([a-f0-9-]+)\/gallery\/([^/]+)$/i;
// New URL pattern: /recipes/{recipeId}/{filename}
const NEW_URL_PATTERN = /^\/recipes\/([a-f0-9-]+)\/([^/]+)$/i;

interface MigrationStats {
  thumbnailsMoved: number;
  galleryMoved: number;
  dbRecordsUpdated: number;
  directoriesCleaned: number;
  errors: string[];
}

/**
 * Migrate all recipe images to per-recipe directory structure.
 *
 * THUMBNAILS:
 * - Old disk: uploads/recipes/{hash}.jpg (flat in recipes dir)
 * - Old URL: /recipes/images/{hash}
 * - New disk: uploads/recipes/{recipeId}/{hash}.jpg
 * - New URL: /recipes/{recipeId}/{hash}
 *
 * GALLERY:
 * - Old disk: uploads/recipes/{recipeId}/gallery/{hash}.jpg
 * - Old URL: /recipes/{recipeId}/gallery/{hash}
 * - New disk: uploads/recipes/{recipeId}/{hash}.jpg
 * - New URL: /recipes/{recipeId}/{hash}
 *
 * STEPS (unchanged):
 * - Disk: uploads/recipes/{recipeId}/steps/{hash}.jpg
 * - URL: /recipes/{recipeId}/steps/{hash}
 *
 * This migration is idempotent - safe to run multiple times.
 */
export async function migrateGalleryImages(): Promise<void> {
  log.info("Starting recipe image migration check...");

  const stats: MigrationStats = {
    thumbnailsMoved: 0,
    galleryMoved: 0,
    dbRecordsUpdated: 0,
    directoriesCleaned: 0,
    errors: [],
  };

  try {
    // Step 1: Migrate thumbnail files from flat structure
    await migrateThumbnails(stats);

    // Step 2: Migrate gallery files from gallery subdirectories
    await migrateGalleryFiles(stats);

    // Step 3: Update database URLs
    await updateDatabaseUrls(stats);

    // Step 4: Clean up empty gallery directories
    await cleanupEmptyGalleryDirs(stats);

    // Log results
    const totalMoved = stats.thumbnailsMoved + stats.galleryMoved;

    if (totalMoved === 0 && stats.dbRecordsUpdated === 0) {
      log.info("Recipe image migration: No migration needed (already up to date)");
    } else {
      log.info(
        {
          thumbnailsMoved: stats.thumbnailsMoved,
          galleryMoved: stats.galleryMoved,
          dbRecordsUpdated: stats.dbRecordsUpdated,
          directoriesCleaned: stats.directoriesCleaned,
          errorCount: stats.errors.length,
        },
        "Recipe image migration completed"
      );
    }

    if (stats.errors.length > 0) {
      log.warn({ errors: stats.errors }, "Recipe image migration completed with errors");
    }
  } catch (err) {
    log.error({ err }, "Recipe image migration failed");
    throw err;
  }
}

/**
 * Migrate thumbnail files from flat recipes directory.
 *
 * Old: uploads/recipes/{hash}.jpg (flat)
 * New: uploads/recipes/{recipeId}/{hash}.jpg
 *
 * Uses database to find which recipe owns each file.
 */
async function migrateThumbnails(stats: MigrationStats): Promise<void> {
  let entries;

  try {
    entries = await fs.readdir(RECIPES_DIR, { withFileTypes: true });
  } catch {
    // Recipes directory doesn't exist yet
    return;
  }

  // Find image files directly in recipes dir (not in subdirectories)
  const flatImageFiles = entries.filter(
    (e) =>
      e.isFile() &&
      [".jpg", ".jpeg", ".png", ".webp", ".avif"].some((ext) => e.name.toLowerCase().endsWith(ext))
  );

  if (flatImageFiles.length === 0) {
    return;
  }

  log.info({ count: flatImageFiles.length }, "Found flat thumbnail files to migrate");

  // Query database to build filename -> recipeId mapping
  // Check both old URL pattern and new URL pattern (in case DB was partially migrated)
  const allRecipes = await db.select({ id: recipes.id, image: recipes.image }).from(recipes);

  const filenameToRecipeId = new Map<string, string>();

  for (const r of allRecipes) {
    if (!r.image) continue;

    // Check old pattern: /recipes/images/{filename}
    const oldMatch = r.image.match(OLD_THUMBNAIL_URL_PATTERN);

    if (oldMatch?.[1]) {
      filenameToRecipeId.set(oldMatch[1], r.id);
      continue;
    }

    // Check new pattern: /recipes/{recipeId}/{filename}
    const newMatch = r.image.match(NEW_URL_PATTERN);

    if (newMatch?.[2]) {
      const filename = newMatch[2];

      filenameToRecipeId.set(filename, r.id);
    }
  }

  log.debug(
    { flatFiles: flatImageFiles.length, mappedFiles: filenameToRecipeId.size },
    "Thumbnail file mapping"
  );

  for (const file of flatImageFiles) {
    const filename = file.name;
    const recipeId = filenameToRecipeId.get(filename);

    if (!recipeId) {
      log.debug({ filename }, "Orphaned thumbnail file, skipping (cleanup job will handle)");
      continue;
    }

    const sourcePath = path.join(RECIPES_DIR, filename);
    const recipeDir = path.join(RECIPES_DIR, recipeId);
    const targetPath = path.join(recipeDir, filename);

    try {
      await fs.mkdir(recipeDir, { recursive: true });

      const targetExists = await fs
        .access(targetPath)
        .then(() => true)
        .catch(() => false);

      if (targetExists) {
        await fs.unlink(sourcePath);
        log.debug({ recipeId, filename }, "Thumbnail already in recipe dir, removed flat source");
      } else {
        await fs.rename(sourcePath, targetPath);
        stats.thumbnailsMoved++;
        log.debug({ recipeId, filename }, "Moved thumbnail to recipe directory");
      }
    } catch (err) {
      stats.errors.push(`Failed to migrate thumbnail ${filename}: ${err}`);
      log.warn({ err, recipeId, filename }, "Failed to migrate thumbnail");
    }
  }
}

/**
 * Migrate gallery files from gallery subdirectories.
 *
 * Old: uploads/recipes/{recipeId}/gallery/{hash}.jpg
 * New: uploads/recipes/{recipeId}/{hash}.jpg
 */
async function migrateGalleryFiles(stats: MigrationStats): Promise<void> {
  let entries;

  try {
    entries = await fs.readdir(RECIPES_DIR, { withFileTypes: true });
  } catch {
    return;
  }

  // Get all recipe directories (UUIDs)
  const recipeDirs = entries.filter((e) => e.isDirectory());

  for (const dir of recipeDirs) {
    const recipeId = dir.name;
    const galleryDir = path.join(RECIPES_DIR, recipeId, "gallery");
    const recipeDir = path.join(RECIPES_DIR, recipeId);

    const galleryExists = await fs
      .access(galleryDir)
      .then(() => true)
      .catch(() => false);

    if (!galleryExists) {
      continue;
    }

    try {
      const galleryFiles = await fs.readdir(galleryDir);
      const imageFiles = galleryFiles.filter((f) =>
        [".jpg", ".jpeg", ".png", ".webp", ".avif"].some((ext) => f.toLowerCase().endsWith(ext))
      );

      for (const filename of imageFiles) {
        const sourcePath = path.join(galleryDir, filename);
        const targetPath = path.join(recipeDir, filename);

        try {
          const targetExists = await fs
            .access(targetPath)
            .then(() => true)
            .catch(() => false);

          if (targetExists) {
            await fs.unlink(sourcePath);
            log.debug(
              { recipeId, filename },
              "Gallery image already in recipe dir, removed source"
            );
          } else {
            await fs.rename(sourcePath, targetPath);
            stats.galleryMoved++;
            log.debug({ recipeId, filename }, "Moved gallery image to recipe directory");
          }
        } catch (err) {
          stats.errors.push(`Failed to migrate gallery ${recipeId}/${filename}: ${err}`);
          log.warn({ err, recipeId, filename }, "Failed to migrate gallery image");
        }
      }
    } catch (err) {
      stats.errors.push(`Error reading gallery for ${recipeId}: ${err}`);
      log.warn({ err, recipeId }, "Error processing gallery directory");
    }
  }
}

/**
 * Update database URLs from old patterns to new pattern.
 *
 * Thumbnails: /recipes/images/{hash} -> /recipes/{recipeId}/{hash}
 * Gallery: /recipes/{recipeId}/gallery/{hash} -> /recipes/{recipeId}/{hash}
 */
async function updateDatabaseUrls(stats: MigrationStats): Promise<void> {
  // Update recipes.image (thumbnails)
  const recipesWithOldUrls = await db
    .select({ id: recipes.id, image: recipes.image })
    .from(recipes)
    .where(like(recipes.image, "/recipes/images/%"));

  for (const record of recipesWithOldUrls) {
    if (!record.image) continue;

    const match = record.image.match(OLD_THUMBNAIL_URL_PATTERN);

    if (match) {
      const filename = match[1];
      const newUrl = `/recipes/${record.id}/${filename}`;

      try {
        await db.update(recipes).set({ image: newUrl }).where(eq(recipes.id, record.id));
        stats.dbRecordsUpdated++;
        log.debug({ recipeId: record.id, oldUrl: record.image, newUrl }, "Updated thumbnail URL");
      } catch (err) {
        stats.errors.push(`Failed to update recipe ${record.id}: ${err}`);
        log.warn({ err, recipeId: record.id }, "Failed to update thumbnail URL in database");
      }
    }
  }

  // Update recipe_images.image (gallery) - check both old patterns
  const galleryImages = await db
    .select({ id: recipeImages.id, recipeId: recipeImages.recipeId, image: recipeImages.image })
    .from(recipeImages)
    .where(
      or(like(recipeImages.image, "/recipes/images/%"), like(recipeImages.image, "%/gallery/%"))
    );

  for (const record of galleryImages) {
    let newUrl: string | null = null;

    // Check for /recipes/images/{filename}
    const thumbnailMatch = record.image.match(OLD_THUMBNAIL_URL_PATTERN);

    if (thumbnailMatch) {
      newUrl = `/recipes/${record.recipeId}/${thumbnailMatch[1]}`;
    }

    // Check for /recipes/{recipeId}/gallery/{filename}
    const galleryMatch = record.image.match(OLD_GALLERY_URL_PATTERN);

    if (galleryMatch) {
      const [, _recipeId, filename] = galleryMatch;

      newUrl = `/recipes/${record.recipeId}/${filename}`;
    }

    if (newUrl) {
      try {
        await db.update(recipeImages).set({ image: newUrl }).where(eq(recipeImages.id, record.id));
        stats.dbRecordsUpdated++;
        log.debug(
          { imageId: record.id, oldUrl: record.image, newUrl },
          "Updated gallery image URL"
        );
      } catch (err) {
        stats.errors.push(`Failed to update recipe_images ${record.id}: ${err}`);
        log.warn({ err, imageId: record.id }, "Failed to update gallery URL in database");
      }
    }
  }
}

/**
 * Clean up empty gallery directories after migration.
 */
async function cleanupEmptyGalleryDirs(stats: MigrationStats): Promise<void> {
  let entries;

  try {
    entries = await fs.readdir(RECIPES_DIR, { withFileTypes: true });
  } catch {
    return;
  }

  const recipeDirs = entries.filter((e) => e.isDirectory());

  for (const dir of recipeDirs) {
    const recipeId = dir.name;
    const galleryDir = path.join(RECIPES_DIR, recipeId, "gallery");

    try {
      const galleryExists = await fs
        .access(galleryDir)
        .then(() => true)
        .catch(() => false);

      if (!galleryExists) {
        continue;
      }

      const remaining = await fs.readdir(galleryDir);

      if (remaining.length === 0) {
        await fs.rmdir(galleryDir);
        stats.directoriesCleaned++;
        log.debug({ recipeId }, "Removed empty gallery directory");
      }
    } catch (err) {
      log.debug({ err, recipeId }, "Could not clean up gallery directory");
    }
  }
}
