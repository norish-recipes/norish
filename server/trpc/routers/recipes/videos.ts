import path from "path";

import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { saveVideoBytes, deleteVideoByUrl } from "@/server/downloader";
import { ALLOWED_VIDEO_MIME_SET } from "@/types";
import { getMaxVideoFileSize } from "@/config/server-config-loader";
import {
  addRecipeVideos,
  deleteRecipeVideoById,
  getRecipeVideoById,
  countRecipeVideos,
  getRecipeOwnerId,
} from "@/server/db/repositories/recipes";
import { MAX_RECIPE_VIDEOS } from "@/server/db/zodSchemas";

// --- Shared Helpers ---

type VideoValidationResult =
  | { success: true; file: File; bytes: Buffer; ext: string }
  | { success: false; error: string };

/**
 * Extract and validate video file from FormData.
 */
async function extractAndValidateVideo(formData: FormData): Promise<VideoValidationResult> {
  const file = formData.get("video") as File | null;

  if (!file) {
    return { success: false, error: "No video file provided" };
  }

  if (!ALLOWED_VIDEO_MIME_SET.has(file.type)) {
    return {
      success: false,
      error: "Invalid file type. Only MP4, WebM, and MOV videos are allowed.",
    };
  }

  const maxVideoFileSize = await getMaxVideoFileSize();

  if (file.size > maxVideoFileSize) {
    const maxMB = Math.round(maxVideoFileSize / 1024 / 1024);

    return { success: false, error: `Video too large. Maximum size is ${maxMB}MB.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Get extension from filename
  const ext = path.extname(file.name).toLowerCase() || ".mp4";

  return { success: true, file, bytes, ext };
}

/**
 * Upload a gallery video (FormData input with recipeId)
 * Videos are stored in: uploads/recipes/{recipeId}/video-{timestamp}.{ext}
 * Also adds entry to recipe_videos table
 */
const uploadGalleryVideo = authedProcedure
  .input(z.instanceof(FormData))
  .mutation(async ({ ctx, input }) => {
    const recipeId = input.get("recipeId") as string | null;
    const orderStr = input.get("order") as string | null;
    const durationStr = input.get("duration") as string | null;

    log.debug({ userId: ctx.user.id, recipeId }, "Uploading gallery video");

    if (!recipeId) {
      return { success: false, error: "Recipe ID is required" };
    }

    // Check max videos limit
    const currentCount = await countRecipeVideos(recipeId);

    if (currentCount >= MAX_RECIPE_VIDEOS) {
      return {
        success: false,
        error: `Maximum ${MAX_RECIPE_VIDEOS} videos allowed per recipe`,
      };
    }

    const validation = await extractAndValidateVideo(input);

    if (!validation.success) {
      return validation;
    }

    try {
      // Parse duration if provided by client
      const duration = durationStr ? parseFloat(durationStr) : undefined;

      // Save video file
      const savedVideo = await saveVideoBytes(validation.bytes, recipeId, validation.ext, duration);

      // Parse order, default to current count (append to end)
      const order = orderStr ? parseInt(orderStr, 10) : currentCount;

      // Check if recipe exists in database before inserting into recipe_videos
      const recipeOwner = await getRecipeOwnerId(recipeId);

      if (recipeOwner !== null) {
        // Recipe exists, add to database
        const [videoRecord] = await addRecipeVideos(recipeId, [
          {
            video: savedVideo.video,
            thumbnail: null, // No thumbnail generation for now
            duration: savedVideo.duration,
            order,
          },
        ]);

        log.info(
          { userId: ctx.user.id, recipeId, url: savedVideo.video, videoId: videoRecord.id },
          "Gallery video uploaded"
        );

        return {
          success: true,
          url: savedVideo.video,
          id: videoRecord.id,
          duration: videoRecord.duration,
          thumbnail: videoRecord.thumbnail,
          order: videoRecord.order,
        };
      } else {
        // Recipe doesn't exist yet (new recipe form), just return the URL
        log.info(
          { userId: ctx.user.id, recipeId, url: savedVideo.video },
          "Gallery video uploaded for pending recipe"
        );

        return {
          success: true,
          url: savedVideo.video,
          duration: savedVideo.duration,
          thumbnail: null,
          order,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload gallery video";

      log.error({ userId: ctx.user.id, recipeId, error }, "Failed to upload gallery video");

      return { success: false, error: message };
    }
  });

/**
 * Delete a gallery video by ID
 * Removes from database and filesystem
 */
const deleteGalleryVideo = authedProcedure
  .input(z.object({ videoId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, videoId: input.videoId }, "Deleting gallery video");

    try {
      // Get video record to get the URL
      const videoRecord = await getRecipeVideoById(input.videoId);

      if (!videoRecord) {
        return { success: false, error: "Video not found" };
      }

      // Delete from filesystem
      try {
        await deleteVideoByUrl(videoRecord.video);
      } catch (fsError) {
        // Log but don't fail - file might already be deleted
        log.warn(
          { userId: ctx.user.id, videoId: input.videoId, error: fsError },
          "Could not delete gallery video file"
        );
      }

      // Delete from database
      await deleteRecipeVideoById(input.videoId);

      log.info(
        { userId: ctx.user.id, videoId: input.videoId, url: videoRecord.video },
        "Gallery video deleted"
      );

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete gallery video";

      log.error(
        { userId: ctx.user.id, videoId: input.videoId, error },
        "Failed to delete gallery video"
      );

      return { success: false, error: message };
    }
  });

export const videosProcedures = router({
  uploadGalleryVideo,
  deleteGalleryVideo,
});
