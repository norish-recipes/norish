import type { FullRecipeInsertDTO } from "@/types/dto/recipe";

import { validateVideoLength, getVideoMetadata, downloadVideoAudio } from "@/server/video/yt-dlp";
import { extractRecipeFromVideo } from "@/server/video/normalizer";
import { cleanupFile } from "@/server/video/cleanup";

import { videoLogger as log } from "@/server/logger";
import { isVideoParsingEnabled } from "@/config/server-config-loader";
import { transcribeAudio } from "@/server/ai/transcriber";
import { isInstagramUrl, isInstagramImagePost, processInstagramImagePost } from "./instagram";

export async function processVideoRecipe(
  url: string,
  allergies?: string[]
): Promise<FullRecipeInsertDTO> {
  const videoEnabled = await isVideoParsingEnabled();

  if (!videoEnabled) {
    throw new Error("AI features or video processing is not enabled.");
  }

  let audioPath: string | null = null;
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
      return await processInstagramImagePost(url, metadata, allergies);
    }

    // Validate video length before downloading (only for actual videos)
    await validateVideoLength(url);
    log.debug({ url }, "Video length validated");

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
        return await processInstagramImagePost(url, metadata, allergies);
      }
      throw audioError;
    }

    // Transcribe audio
    log.info({ url }, "Starting audio transcription");
    const transcript = await transcribeAudio(audioPath);

    log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

    // Extract recipe from transcript + metadata
    const result = await extractRecipeFromVideo(transcript, metadata, url, allergies);

    if (!result.success) {
      throw new Error(
        result.error ||
          `No recipe found in video. The video may not contain a recipe or the content was not clear enough to extract.`
      );
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
  }
}
