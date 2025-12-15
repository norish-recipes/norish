import fs from "fs/promises";
import path from "path";

import { db } from "../db/drizzle";
import { recipes } from "../db/schema";
import { getAllUserAvatars } from "../db/repositories";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { schedulerLogger } from "@/server/logger";

const RECIPES_DISK_DIR = path.join(SERVER_CONFIG.UPLOADS_DIR, "uploads", "recipes");
const RECIPES_WEB_PREFIX = "/recipes/images";
const AVATARS_DISK_DIR = path.join(SERVER_CONFIG.UPLOADS_DIR, "avatars");

/**
 * Clean up orphaned recipe images that aren't referenced in the database
 */
export async function cleanupOrphanedImages(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    // Get all image files from disk
    let files;

    try {
      files = await fs.readdir(RECIPES_DISK_DIR);
    } catch {
      // Directory doesn't exist, nothing to clean up
      return { deleted: 0, errors: 0 };
    }

    const imageFiles = files.filter(
      (f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png") || f.endsWith(".webp")
    );

    if (imageFiles.length === 0) {
      schedulerLogger.info("No images found in recipes directory");

      return { deleted: 0, errors: 0 };
    }

    // Get all image URLs from database
    const allRecipes = await db.select({ image: recipes.image }).from(recipes);
    const usedImages = new Set(
      allRecipes
        .map((r) => r.image)
        .filter(Boolean)
        .map((url) => {
          // Extract filename from URL like "/recipes/images/abc123.jpg"
          if (url && url.startsWith(RECIPES_WEB_PREFIX)) {
            return url.substring(RECIPES_WEB_PREFIX.length + 1);
          }

          return null;
        })
        .filter(Boolean) as string[]
    );

    schedulerLogger.info(
      { total: imageFiles.length, referenced: usedImages.size },
      "Found image files"
    );

    // Delete orphaned images
    for (const file of imageFiles) {
      if (!usedImages.has(file)) {
        try {
          const filePath = path.join(RECIPES_DISK_DIR, file);

          await fs.unlink(filePath);
          deleted++;
          schedulerLogger.info({ file }, "Deleted orphaned image");
        } catch (err) {
          errors++;
          schedulerLogger.error({ err, file }, "Error deleting image");
        }
      }
    }

    schedulerLogger.info({ deleted, errors }, "Image cleanup complete");
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during image cleanup");
    errors++;
  }

  return { deleted, errors };
}

/**
 * Delete a specific image file by URL
 */
export async function deleteImageByUrl(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl || !imageUrl.startsWith(RECIPES_WEB_PREFIX)) {
    return;
  }

  const filename = imageUrl.substring(RECIPES_WEB_PREFIX.length + 1);
  const filePath = path.join(RECIPES_DISK_DIR, filename);

  try {
    await fs.unlink(filePath);
    schedulerLogger.info({ filename }, "Deleted image");
  } catch (err) {
    // Ignore errors (file might not exist)
    schedulerLogger.warn({ err, filename }, "Could not delete image");
  }
}

/**
 * Clean up orphaned avatar images that aren't referenced in the database
 */
export async function cleanupOrphanedAvatars(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    // Get all avatar files from disk
    let files;

    try {
      files = await fs.readdir(AVATARS_DISK_DIR);
    } catch {
      // Directory doesn't exist, nothing to clean up
      return { deleted: 0, errors: 0 };
    }

    const avatarFiles = files.filter(
      (f) =>
        f.endsWith(".jpg") ||
        f.endsWith(".jpeg") ||
        f.endsWith(".png") ||
        f.endsWith(".webp") ||
        f.endsWith(".gif")
    );

    if (avatarFiles.length === 0) {
      schedulerLogger.info("No avatar images found");

      return { deleted: 0, errors: 0 };
    }

    // Get all users with avatars from database
    const usersWithAvatars = await getAllUserAvatars();

    // Extract filenames from encrypted paths
    // Avatar paths are stored encrypted but follow pattern /avatars/{userId}.{ext}
    const usedAvatars = new Set<string>();

    for (const user of usersWithAvatars) {
      if (user.image) {
        // The encrypted field contains the path pattern, extract potential filename
        // Avatars use pattern: {userId}.{ext}
        // Since we store encrypted paths, we need to check which files match user IDs
        const userIdPattern = `${user.userId}.`;
        const matchingFiles = avatarFiles.filter((f) => f.startsWith(userIdPattern));

        matchingFiles.forEach((f) => usedAvatars.add(f));
      }
    }

    schedulerLogger.info(
      { total: avatarFiles.length, referenced: usedAvatars.size },
      "Found avatar files"
    );

    // Delete orphaned avatars
    for (const file of avatarFiles) {
      if (!usedAvatars.has(file)) {
        try {
          const filePath = path.join(AVATARS_DISK_DIR, file);

          await fs.unlink(filePath);
          deleted++;
          schedulerLogger.info({ file }, "Deleted orphaned avatar");
        } catch (err) {
          errors++;
          schedulerLogger.error({ err, file }, "Error deleting avatar");
        }
      }
    }

    schedulerLogger.info({ deleted, errors }, "Avatar cleanup complete");
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during avatar cleanup");
    errors++;
  }

  return { deleted, errors };
}

/**
 * Delete a specific avatar file by filename
 */
export async function deleteAvatarByFilename(filename: string | null | undefined): Promise<void> {
  if (!filename) {
    return;
  }

  const filePath = path.join(AVATARS_DISK_DIR, filename);

  try {
    await fs.unlink(filePath);
    schedulerLogger.info({ filename }, "Deleted avatar");
  } catch (err) {
    // Ignore errors (file might not exist)
    schedulerLogger.warn({ err, filename }, "Could not delete avatar");
  }
}

export async function cleanupOrphanedStepImages(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  const recipesDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes");

  try {
    // Get all subdirectories in uploads/recipes/
    let entries;

    try {
      entries = await fs.readdir(recipesDir, { withFileTypes: true });
    } catch {
      // Directory doesn't exist, nothing to clean up
      return { deleted: 0, errors: 0 };
    }

    // Filter to directories only (these should be recipe IDs)
    const recipeIdDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    if (recipeIdDirs.length === 0) {
      return { deleted: 0, errors: 0 };
    }

    // Get all existing recipe IDs from database
    const existingRecipes = await db.select({ id: recipes.id }).from(recipes);
    const existingRecipeIds = new Set(existingRecipes.map((r) => r.id));

    schedulerLogger.info(
      { totalDirs: recipeIdDirs.length, existingRecipes: existingRecipeIds.size },
      "Checking step image directories"
    );

    // Delete directories for recipes that no longer exist
    for (const recipeId of recipeIdDirs) {
      // Skip "images" directory (main recipe images directory)
      if (recipeId === "images") {
        continue;
      }

      if (!existingRecipeIds.has(recipeId)) {
        try {
          const dirPath = path.join(recipesDir, recipeId);

          await fs.rm(dirPath, { recursive: true, force: true });
          deleted++;
          schedulerLogger.info({ recipeId }, "Deleted orphaned step images directory");
        } catch (err) {
          errors++;
          schedulerLogger.error({ err, recipeId }, "Error deleting step images directory");
        }
      }
    }

    schedulerLogger.info({ deleted, errors }, "Step images cleanup complete");
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during step images cleanup");
    errors++;
  }

  return { deleted, errors };
}
