import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { extractRecipeFromVideo } from "@norish/api/video/normalizer";
import { downloadCaptions, parseVttFile } from "@norish/api/video/yt-dlp";
import { transcribe } from "@norish/shared-server/ai/runtime/runtime";
import { videoLogger as log } from "@norish/shared-server/logger";

import type { VideoProcessorContext } from "../types";
import { BaseVideoProcessor } from "../base-processor";

/**
 * YouTube video processor.
 * Prefers captions + description, falls back to audio transcription.
 */
export class YouTubeProcessor extends BaseVideoProcessor {
  readonly name = "YouTubeProcessor";

  async process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO> {
    const { url, recipeId, tokens } = context;

    let audioPath: string | null = null;
    let videoPath: string | null = null;
    let captionPath: string | null = null;

    try {
      log.info({ url }, "Processing YouTube video");

      const metadata = await this.getMetadata(url, tokens);

      await this.validateLength(url, tokens);

      // Download video file
      videoPath = await this.downloadAndConvertVideo(url, tokens);

      // Try to get captions first (cheaper than audio transcription)
      let captionText: string | null = null;

      try {
        log.info({ url }, "Attempting to download captions");
        const captionResult = await downloadCaptions(url, tokens, metadata.language);

        if (captionResult.found && captionResult.filePath) {
          captionPath = captionResult.filePath;
          captionText = await parseVttFile(captionResult.filePath);
          log.info({ url, captionLength: captionText.length }, "Captions downloaded and parsed");
        }
      } catch (captionErr) {
        log.debug({ url, err: captionErr }, "Could not get captions, will use audio transcription");
      }

      // Build combined text from captions + description
      const descriptionText = metadata.description?.trim() || "";
      const combinedCaptionAndDescription = [captionText, descriptionText]
        .filter(Boolean)
        .join("\n\n---\n\n");

      // If we have substantial caption/description content, try extraction without audio
      const hasSubstantialContent = combinedCaptionAndDescription.length > 200;

      if (hasSubstantialContent) {
        log.info(
          { url, contentLength: combinedCaptionAndDescription.length },
          "Trying extraction from captions + description first"
        );

        // A failed caption extraction is not terminal: the audio itself is
        // still there to transcribe.
        try {
          const recipe = await extractRecipeFromVideo(
            combinedCaptionAndDescription,
            metadata,
            recipeId,
            url
          );

          log.info({ url }, "Successfully extracted recipe from captions + description");
          const savedVideo = videoPath
            ? await this.saveVideo(videoPath, recipeId, metadata.duration)
            : null;

          return this.addVideoToRecipe(recipe, savedVideo);
        } catch (captionExtractionError) {
          log.info(
            { url, err: captionExtractionError },
            "Caption/description extraction failed, falling back to transcription"
          );
        }
      }

      // Fall back to audio transcription
      audioPath = await this.downloadAudio(url, tokens);
      log.info({ url }, "Starting audio transcription");

      const transcript = await transcribe(audioPath);

      log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

      // Combine transcript with description
      const combinedTranscriptAndDescription = [transcript, descriptionText]
        .filter(Boolean)
        .join("\n\n---\n\n");

      const recipe = await extractRecipeFromVideo(
        combinedTranscriptAndDescription,
        metadata,
        recipeId,
        url
      );

      const savedVideo = videoPath
        ? await this.saveVideo(videoPath, recipeId, metadata.duration)
        : null;

      return this.addVideoToRecipe(recipe, savedVideo);
    } finally {
      await this.cleanup(audioPath, captionPath);
      if (videoPath?.includes("video-temp")) {
        await this.cleanup(videoPath);
      }
    }
  }
}
