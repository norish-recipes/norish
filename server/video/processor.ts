import type { FullRecipeInsertDTO } from "@/types/dto/recipe";

import { isInstagramUrl, isInstagramImagePost, processInstagramImagePost } from "./instagram";

import {
  validateVideoLength,
  getVideoMetadata,
  downloadVideoAudio,
  downloadVideo,
  getFfmpegPath,
} from "@/server/video/yt-dlp";
import { extractRecipeFromVideo } from "@/server/video/normalizer";
import { cleanupFile } from "@/server/video/cleanup";
import { videoLogger as log } from "@/server/logger";
import { isVideoParsingEnabled } from "@/config/server-config-loader";
import { transcribeAudio } from "@/server/ai/transcriber";
import { convertToMp4, saveVideoFile } from "@/server/downloader";

export async function processVideoRecipe(
  url: string,
  recipeId: string,
  allergies?: string[]
): Promise<FullRecipeInsertDTO> {
  const videoEnabled = await isVideoParsingEnabled();

  if (!videoEnabled) {
    throw new Error("AI features or video processing is not enabled.");
  }

  let audioPath: string | null = null;
  let videoPath: string | null = null;
  const isInstagram = isInstagramUrl(url);

  try {
    log.info({ url, isInstagram }, "Starting video recipe processing");

    // Get metadata first - needed to detect Instagram image posts
    const metadata = await getVideoMetadata(url);

    log.info(
      { url, title: metadata.title, duration: metadata.duration },
      "Video metadata retrieved"
    );

    // Handle Instagram image posts (duration is 0 or undefined)
    if (isInstagram && isInstagramImagePost(metadata)) {
      log.info({ url }, "Detected Instagram image post, extracting from description");

      return await processInstagramImagePost(url, recipeId, metadata, allergies);
    }

    // Validate video length before downloading (only for actual videos)
    await validateVideoLength(url);
    log.debug({ url }, "Video length validated");

    // Download video file for saving
    let canSaveVideo = true;

    try {
      log.info({ url }, "Downloading video file");
      const downloadedVideo = await downloadVideo(url);

      videoPath = downloadedVideo.filePath;

      // Convert to MP4 if needed
      const ffmpegPath = getFfmpegPath();
      const convertResult = await convertToMp4(downloadedVideo.filePath, ffmpegPath);

      videoPath = convertResult.filePath;

      log.info(
        { method: convertResult.method, converted: convertResult.converted },
        "Video conversion complete"
      );
    } catch (videoDownloadErr) {
      canSaveVideo = false;
      log.warn(
        { err: videoDownloadErr },
        "Failed to download/save video file, continuing with recipe extraction"
      );
      // Continue - we can still extract the recipe from audio even if video save fails
    }

    // Download and extract audio - with fallback for Instagram if audio extraction fails
    try {
      audioPath = await downloadVideoAudio(url);
      log.debug({ url, audioPath }, "Audio downloaded");
    } catch (audioError: unknown) {
      // Safety net: If audio download fails for Instagram, try description-based extraction
      if (isInstagram) {
        log.warn(
          { url, err: audioError },
          "Audio download failed for Instagram, attempting description-based extraction"
        );

        const result = await processInstagramImagePost(url, recipeId, metadata, allergies);

        // Add video if we managed to save it
        const savedVideo = canSaveVideo
          ? await saveVideo(videoPath!, recipeId, metadata.duration).catch(() => null)
          : null;

        if (savedVideo) {
          result.videos = [{ video: savedVideo.video, duration: savedVideo.duration, order: 0 }];
        }

        return result;
      }
      throw audioError;
    }

    // Transcribe audio
    log.info({ url }, "Starting audio transcription");
    const transcriptionResult = await transcribeAudio(audioPath);

    if (!transcriptionResult.success) {
      throw new Error(transcriptionResult.error);
    }

    const transcript = transcriptionResult.data;

    log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

    // Extract recipe from transcript + metadata
    const result = await extractRecipeFromVideo(transcript, metadata, recipeId, url, allergies);

    if (!result.success) {
      throw new Error(
        result.error ||
          `No recipe found in video. The video may not contain a recipe or the content was not clear enough to extract.`
      );
    }

    // Add video to the recipe if we saved it
    const savedVideo = canSaveVideo
      ? await saveVideo(videoPath!, recipeId, metadata.duration).catch(() => null)
      : null;

    if (savedVideo) {
      result.data.videos = [{ video: savedVideo.video, duration: savedVideo.duration, order: 0 }];
    }

    return result.data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    log.error({ err: error }, "Failed to process video");

    throw new Error(`Failed to process video recipe: ${errorMessage}`);
  } finally {
    // Always cleanup temporary audio file
    if (audioPath) {
      await cleanupFile(audioPath);
    }
    // Cleanup temp video file if it exists and is still in temp dir
    if (videoPath && videoPath.includes("video-temp")) {
      await cleanupFile(videoPath);
    }
  }
}

const saveVideo = async (videoPath: string, recipeId: string, duration: number | undefined) => {
  // Save the video file to the recipe directory
  const savedVideo = await saveVideoFile(videoPath, recipeId, duration);

  log.info({ video: savedVideo.video }, "Video saved to recipe directory");

  return savedVideo;
};
