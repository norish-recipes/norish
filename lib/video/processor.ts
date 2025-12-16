import type { FullRecipeInsertDTO } from "@/types/dto/recipe";

import { validateVideoLength, getVideoMetadata, downloadVideoAudio } from "./yt-dlp";
import { extractRecipeFromVideo } from "./normalizer";
import { cleanupFile } from "./cleanup";

import { videoLogger as log } from "@/server/logger";
import { isVideoParsingEnabled } from "@/config/server-config-loader";
import { transcribeAudio } from "@/server/ai/transcriber";

export async function processVideoRecipe(
  url: string,
  allergies?: string[]
): Promise<FullRecipeInsertDTO> {
  const videoEnabled = await isVideoParsingEnabled();

  if (!videoEnabled) {
    throw new Error("AI features or video processing is not enabled.");
  }

  let audioPath: string | null = null;

  try {
    log.info({ url }, "Starting video recipe processing");

    // Validate video length before downloading
    await validateVideoLength(url);
    log.debug({ url }, "Video length validated");

    // Get metadata
    const metadata = await getVideoMetadata(url);

    log.info(
      { url, title: metadata.title, duration: metadata.duration },
      "Video metadata retrieved"
    );

    // Download and extract audio
    audioPath = await downloadVideoAudio(url);
    log.debug({ url, audioPath }, "Audio downloaded");

    // Transcribe audio
    log.info({ url }, "Starting audio transcription");
    const transcript = await transcribeAudio(audioPath);

    log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

    // Extract recipe from transcript + metadata
    const recipe = await extractRecipeFromVideo(transcript, metadata, url, allergies);

    if (!recipe) {
      throw new Error(
        `No recipe found in video. The video may not contain a recipe or the content was not clear enough to extract.`
      );
    }

    return recipe;
  } catch (error: any) {
    log.error({ err: error }, "Failed to process video");

    // Provide user-friendly error messages
    if (error.message.includes("exceeds maximum length")) {
      throw error; // Already has good message
    }
    if (error.message.includes("not enabled")) {
      throw error; // Already has good message
    }
    if (error.message.includes("unavailable") || error.message.includes("private")) {
      throw error; // Already has good message
    }
    if (error.message.includes("not supported")) {
      throw error; // Already has good message
    }
    if (error.message.includes("No recipe found")) {
      throw error; // Already has good message
    }

    // Generic error
    const errorMessage = error.message || "Unknown error";

    throw new Error(`Failed to process video recipe: ${errorMessage}`);
  } finally {
    // Always cleanup temporary audio file
    if (audioPath) {
      await cleanupFile(audioPath);
    }
  }
}
