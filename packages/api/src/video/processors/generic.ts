import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { extractRecipeFromVideo } from "@norish/api/video/normalizer";
import { transcribe } from "@norish/shared-server/ai/runtime/runtime";
import { videoLogger as log } from "@norish/shared-server/logger";

import type { VideoProcessorContext } from "../types";
import { BaseVideoProcessor } from "../base-processor";

/**
 * Generic video processor for platforms without specific handling.
 * Always transcribes audio and combines with description.
 */
export class GenericVideoProcessor extends BaseVideoProcessor {
  readonly name = "GenericVideoProcessor";

  async process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO> {
    const { url, recipeId, tokens } = context;

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

      const transcript = await transcribe(audioPath);

      log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

      // Combine transcript with description
      const descriptionText = metadata.description?.trim() || "";
      const combinedText = [transcript, descriptionText].filter(Boolean).join("\n\n---\n\n");

      const recipe = await extractRecipeFromVideo(combinedText, metadata, recipeId, url);

      const savedVideo = videoPath
        ? await this.saveVideo(videoPath, recipeId, metadata.duration)
        : null;

      return this.addVideoToRecipe(recipe, savedVideo);
    } finally {
      await this.cleanup(audioPath);
      if (videoPath?.includes("video-temp")) {
        await this.cleanup(videoPath);
      }
    }
  }
}
