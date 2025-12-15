import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { saveImageBytes, saveStepImageBytes, deleteStepImageByUrl } from "@/lib/downloader";
import { deleteImageByUrl } from "@/server/startup/image-cleanup";
import { ALLOWED_IMAGE_MIME_SET, MAX_RECIPE_IMAGE_SIZE } from "@/types";

// Web prefix for recipe images (must match downloader.ts)
const RECIPES_WEB_PREFIX = "/recipes/images";

/**
 * Upload a recipe image (FormData input)
 */
const uploadImage = authedProcedure
  .input(z.instanceof(FormData))
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id }, "Uploading recipe image");

    const file = input.get("image") as File | null;

    if (!file) {
      return { success: false, error: "No image file provided" };
    }

    // Validate file type
    if (!ALLOWED_IMAGE_MIME_SET.has(file.type)) {
      return {
        success: false,
        error: "Invalid file type. Only JPEG, PNG, WebP, and AVIF images are allowed.",
      };
    }

    // Validate file size
    if (file.size > MAX_RECIPE_IMAGE_SIZE) {
      return { success: false, error: "File too large. Maximum size is 10MB." };
    }

    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const url = await saveImageBytes(bytes, file.name);

      log.info({ userId: ctx.user.id, url }, "Recipe image uploaded");

      return { success: true, url };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload image";

      log.error({ userId: ctx.user.id, error }, "Failed to upload recipe image");

      return { success: false, error: message };
    }
  });

/**
 * Delete a recipe image by URL
 */
const deleteImage = authedProcedure
  .input(z.object({ url: z.string() }))
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, url: input.url }, "Deleting recipe image");

    // Ensure we're only deleting recipe images (not avatars or other files)
    if (!input.url.startsWith(RECIPES_WEB_PREFIX)) {
      return { success: false, error: "Invalid image URL format" };
    }

    try {
      await deleteImageByUrl(input.url);

      log.info({ userId: ctx.user.id, url: input.url }, "Recipe image deleted");

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete image";

      log.error({ userId: ctx.user.id, error }, "Failed to delete recipe image");

      return { success: false, error: message };
    }
  });

/**
 * Upload a step image (FormData input with recipeId)
 * Images are stored in: uploads/recipes/<recipeId>/steps/<imageId>.jpg
 */
const uploadStepImage = authedProcedure
  .input(z.instanceof(FormData))
  .mutation(async ({ ctx, input }) => {
    const recipeId = input.get("recipeId") as string | null;
    const file = input.get("image") as File | null;

    log.debug({ userId: ctx.user.id, recipeId }, "Uploading step image");

    if (!recipeId) {
      return { success: false, error: "Recipe ID is required" };
    }

    if (!file) {
      return { success: false, error: "No image file provided" };
    }

    // Validate file type
    if (!ALLOWED_IMAGE_MIME_SET.has(file.type)) {
      return {
        success: false,
        error: "Invalid file type. Only JPEG, PNG, WebP, and AVIF images are allowed.",
      };
    }

    // Validate file size
    if (file.size > MAX_RECIPE_IMAGE_SIZE) {
      return { success: false, error: "File too large. Maximum size is 10MB." };
    }

    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const url = await saveStepImageBytes(bytes, recipeId);

      log.info({ userId: ctx.user.id, recipeId, url }, "Step image uploaded");

      return { success: true, url };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload step image";

      log.error({ userId: ctx.user.id, recipeId, error }, "Failed to upload step image");

      return { success: false, error: message };
    }
  });

const deleteStepImage = authedProcedure
  .input(z.object({ url: z.string() }))
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, url: input.url }, "Deleting step image");

    try {
      await deleteStepImageByUrl(input.url);

      log.info({ userId: ctx.user.id, url: input.url }, "Step image deleted");

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete step image";

      log.warn({ userId: ctx.user.id, error, url: input.url }, "Could not delete step image");

      return { success: false, error: message };
    }
  });

export const imagesProcedures = router({
  uploadImage,
  deleteImage,
  uploadStepImage,
  deleteStepImage,
});
