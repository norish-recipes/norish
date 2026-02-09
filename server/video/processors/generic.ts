import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import type { VideoProcessorContext } from "../types";

import { BaseVideoProcessor } from "../base-processor";

import { videoLogger as log } from "@/server/logger";
import { transcribeAudio } from "@/server/ai/transcriber";
import { extractRecipeFromVideo } from "@/server/video/normalizer";

/**
 * Generic video processor for platforms without specific handling.
 * Always transcribes audio and combines with description.
 */
export class GenericVideoProcessor extends BaseVideoProcessor {
  readonly name = "GenericVideoProcessor";

  async process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO> {
    const { url, recipeId, allergies, tokens } = context;

    let audioPath: string | null = null;
    let videoPath: string | null = null;

    try {
      log.info({ url }, "Processing generic video");

      const metadata = await this.getMetadata(url, tokens);

      await this.validateLength(url, tokens);

      // Download video file
      videoPath = await this.downloadAndConvertVideo(url, tokens);

      // Download and transcribe audio
      audioPath = await this.downloadAudio(url, tokens);
      log.info({ url }, "Starting audio transcription");

      const transcriptionResult = await transcribeAudio(audioPath);

      if (!transcriptionResult.success) {
        throw new Error(transcriptionResult.error);
      }

      const transcript = transcriptionResult.data;

      log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

      // Combine transcript with description
      const descriptionText = metadata.description?.trim() || "";
      const combinedText = [transcript, descriptionText].filter(Boolean).join("\n\n---\n\n");

      const result = await extractRecipeFromVideo(combinedText, metadata, recipeId, url, allergies);

      if (!result.success) {
        throw new Error(
          result.error ||
            "No recipe found in video. The video may not contain a recipe or the content was not clear enough to extract."
        );
      }

      const savedVideo = videoPath
        ? await this.saveVideo(videoPath, recipeId, metadata.duration)
        : null;

      return this.addVideoToRecipe(result.data, savedVideo);
    } finally {
      await this.cleanup(audioPath);
      if (videoPath?.includes("video-temp")) {
        await this.cleanup(videoPath);
      }
    }
  }
}
