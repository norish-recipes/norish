import type { Dirent } from "node:fs";

import fs from "node:fs/promises";
import path from "node:path";

import { db } from "../db/drizzle";
import { recipes, recipeImages, recipeVideos, stepImages } from "../db/schema";
import { getAllUserAvatars } from "../db/repositories";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { schedulerLogger } from "@/server/logger";
import { isAvatarFilenameForUser } from "@/lib/helpers";

function getRecipesDiskDir() {
  return path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes");
}

function getAvatarsDiskDir() {
  return path.join(SERVER_CONFIG.UPLOADS_DIR, "avatars");
}

const ROOT_RECIPE_MEDIA_URL_PATTERN = /^\/recipes\/([a-f0-9-]{36})\/([^/]+)$/i;
const STEP_IMAGE_URL_PATTERN = /^\/recipes\/([a-f0-9-]{36})\/steps\/([^/]+)$/i;

function normalizeMediaUrl(mediaUrl: string): string {
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
    try {
      return new URL(mediaUrl).pathname;
    } catch {
      return mediaUrl;
    }
  }

  return mediaUrl;
}

function getReferenceSet(references: Map<string, Set<string>>, recipeId: string): Set<string> {
  if (!references.has(recipeId)) {
    references.set(recipeId, new Set<string>());
  }

  return references.get(recipeId)!;
}

function registerRootMediaReference(
  references: Map<string, Set<string>>,
  mediaUrl: string | null | undefined
) {
  if (!mediaUrl) {
    return;
  }

  const normalizedUrl = normalizeMediaUrl(mediaUrl);
  const match = normalizedUrl.match(ROOT_RECIPE_MEDIA_URL_PATTERN);

  if (!match) {
    return;
  }

  const [, recipeId, filename] = match;

  getReferenceSet(references, recipeId).add(filename);
}

function registerStepImageReference(
  references: Map<string, Set<string>>,
  mediaUrl: string | null | undefined
) {
  if (!mediaUrl) {
    return;
  }

  const normalizedUrl = normalizeMediaUrl(mediaUrl);
  const match = normalizedUrl.match(STEP_IMAGE_URL_PATTERN);

  if (!match) {
    return;
  }

  const [, recipeId, filename] = match;

  getReferenceSet(references, recipeId).add(filename);
}

/**
 * Clean up orphaned recipe media in uploads/recipes.
 * - Deletes top-level recipe folders whose name is not present in recipes.id
 * - Deletes unreferenced root files in uploads/recipes/{recipeId}/
 */
export async function cleanupOrphanedImages(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    let entries: Dirent[];

    try {
      entries = await fs.readdir(getRecipesDiskDir(), { withFileTypes: true });
    } catch {
      return { deleted: 0, errors: 0 };
    }

    const recipeDirs = entries.filter((entry) => entry.isDirectory());

    if (recipeDirs.length === 0) {
      schedulerLogger.info("No recipe directories found");

      return { deleted: 0, errors: 0 };
    }

    const [allRecipes, allGalleryImages, allRecipeVideos] = await Promise.all([
      db.select({ id: recipes.id, image: recipes.image }).from(recipes),
      db.select({ image: recipeImages.image }).from(recipeImages),
      db.select({ video: recipeVideos.video }).from(recipeVideos),
    ]);

    const existingRecipeIds = new Set(allRecipes.map((recipe) => recipe.id));
    const referencedRootFiles = new Map<string, Set<string>>();

    for (const recipe of allRecipes) {
      registerRootMediaReference(referencedRootFiles, recipe.image);
    }

    for (const image of allGalleryImages) {
      registerRootMediaReference(referencedRootFiles, image.image);
    }

    for (const video of allRecipeVideos) {
      registerRootMediaReference(referencedRootFiles, video.video);
    }

    let deletedRecipeDirs = 0;
    let deletedRootFiles = 0;

    for (const dir of recipeDirs) {
      const recipeId = dir.name;
      const recipeDir = path.join(getRecipesDiskDir(), recipeId);

      if (!existingRecipeIds.has(recipeId)) {
        try {
          await fs.rm(recipeDir, { recursive: true, force: true });
          deleted++;
          deletedRecipeDirs++;
          schedulerLogger.info({ recipeId }, "Deleted orphaned recipe directory");
        } catch (err) {
          errors++;
          schedulerLogger.error({ err, recipeId }, "Error deleting recipe directory");
        }

        continue;
      }

      try {
        const rootEntries = await fs.readdir(recipeDir, { withFileTypes: true });
        const referenced = referencedRootFiles.get(recipeId) ?? new Set<string>();

        for (const entry of rootEntries) {
          if (!entry.isFile()) {
            continue;
          }

          if (referenced.has(entry.name)) {
            continue;
          }

          try {
            const filePath = path.join(recipeDir, entry.name);

            await fs.unlink(filePath);
            deleted++;
            deletedRootFiles++;
            schedulerLogger.info(
              { recipeId, file: entry.name },
              "Deleted unreferenced recipe root media file"
            );
          } catch (err) {
            errors++;
            schedulerLogger.error(
              { err, recipeId, file: entry.name },
              "Error deleting recipe root media file"
            );
          }
        }
      } catch (err) {
        schedulerLogger.error({ err, recipeId }, "Error scanning recipe directory");
        errors++;
      }
    }

    schedulerLogger.info(
      {
        deleted,
        errors,
        deletedRecipeDirs,
        deletedRootFiles,
      },
      "Recipe media cleanup complete"
    );
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during recipe media cleanup");
    errors++;
  }

  return { deleted, errors };
}

/**
 * Delete a specific recipe root media file by URL.
 * URL format: /recipes/{recipeId}/{filename}
 */
export async function deleteImageByUrl(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) {
    return;
  }

  const normalizedUrl = normalizeMediaUrl(imageUrl);
  const match = normalizedUrl.match(ROOT_RECIPE_MEDIA_URL_PATTERN);

  if (!match) {
    schedulerLogger.warn({ imageUrl }, "Invalid recipe media URL format");

    return;
  }

  const [, recipeId, filename] = match;
  const filePath = path.join(getRecipesDiskDir(), recipeId, filename);

  try {
    await fs.unlink(filePath);
    schedulerLogger.info({ recipeId, filename }, "Deleted recipe media file");
  } catch (err) {
    schedulerLogger.warn({ err, recipeId, filename }, "Could not delete recipe media file");
  }
}

/**
 * Clean up orphaned avatar images that are not referenced in the database.
 */
export async function cleanupOrphanedAvatars(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    let files: string[];

    try {
      files = await fs.readdir(getAvatarsDiskDir());
    } catch {
      return { deleted: 0, errors: 0 };
    }

    const avatarFiles = files.filter(
      (file) =>
        file.endsWith(".jpg") ||
        file.endsWith(".jpeg") ||
        file.endsWith(".png") ||
        file.endsWith(".webp") ||
        file.endsWith(".gif")
    );

    if (avatarFiles.length === 0) {
      schedulerLogger.info("No avatar images found");

      return { deleted: 0, errors: 0 };
    }

    const usersWithAvatars = await getAllUserAvatars();
    const usedAvatars = new Set<string>();

    for (const user of usersWithAvatars) {
      if (!user.image) {
        continue;
      }

      const matchingFiles = avatarFiles.filter((file) =>
        isAvatarFilenameForUser(file, user.userId)
      );

      for (const file of matchingFiles) {
        usedAvatars.add(file);
      }
    }

    schedulerLogger.info(
      { total: avatarFiles.length, referenced: usedAvatars.size },
      "Found avatar files"
    );

    for (const file of avatarFiles) {
      if (usedAvatars.has(file)) {
        continue;
      }

      try {
        const filePath = path.join(getAvatarsDiskDir(), file);

        await fs.unlink(filePath);
        deleted++;
        schedulerLogger.info({ file }, "Deleted orphaned avatar");
      } catch (err) {
        errors++;
        schedulerLogger.error({ err, file }, "Error deleting avatar");
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
 * Delete a specific avatar file by filename.
 */
export async function deleteAvatarByFilename(filename: string | null | undefined): Promise<void> {
  if (!filename) {
    return;
  }

  const filePath = path.join(getAvatarsDiskDir(), filename);

  try {
    await fs.unlink(filePath);
    schedulerLogger.info({ filename }, "Deleted avatar");
  } catch (err) {
    schedulerLogger.warn({ err, filename }, "Could not delete avatar");
  }
}

/**
 * Clean up orphaned step images in uploads/recipes/{recipeId}/steps.
 */
export async function cleanupOrphanedStepImages(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    let entries: Dirent[];

    try {
      entries = await fs.readdir(getRecipesDiskDir(), { withFileTypes: true });
    } catch {
      return { deleted: 0, errors: 0 };
    }

    const recipeDirs = entries.filter((entry) => entry.isDirectory());

    if (recipeDirs.length === 0) {
      return { deleted: 0, errors: 0 };
    }

    const allStepImageRows = await db.select({ image: stepImages.image }).from(stepImages);
    const referencedStepFiles = new Map<string, Set<string>>();

    for (const row of allStepImageRows) {
      registerStepImageReference(referencedStepFiles, row.image);
    }

    for (const dir of recipeDirs) {
      const recipeId = dir.name;
      const stepImagesDir = path.join(getRecipesDiskDir(), recipeId, "steps");
      const referenced = referencedStepFiles.get(recipeId) ?? new Set<string>();

      let stepEntries: Dirent[];

      try {
        stepEntries = await fs.readdir(stepImagesDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of stepEntries) {
        if (!entry.isFile()) {
          continue;
        }

        if (referenced.has(entry.name)) {
          continue;
        }

        try {
          const filePath = path.join(stepImagesDir, entry.name);

          await fs.unlink(filePath);
          deleted++;
          schedulerLogger.info(
            { recipeId, file: entry.name },
            "Deleted unreferenced recipe step image"
          );
        } catch (err) {
          errors++;
          schedulerLogger.error({ err, recipeId, file: entry.name }, "Error deleting step image");
        }
      }
    }

    schedulerLogger.info({ deleted, errors }, "Step image cleanup complete");
  } catch (err) {
    schedulerLogger.error({ err }, "Fatal error during step image cleanup");
    errors++;
  }

  return { deleted, errors };
}
