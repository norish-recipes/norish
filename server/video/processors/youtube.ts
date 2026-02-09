import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import type { VideoProcessorContext } from "../types";

import { BaseVideoProcessor } from "../base-processor";

import { videoLogger as log } from "@/server/logger";
import { transcribeAudio } from "@/server/ai/transcriber";
import { extractRecipeFromVideo } from "@/server/video/normalizer";
import { downloadCaptions, parseVttFile } from "@/server/video/yt-dlp";

/**
 * YouTube video processor.
 * Prefers captions + description, falls back to audio transcription.
 */
export class YouTubeProcessor extends BaseVideoProcessor {
  readonly name = "YouTubeProcessor";

  async process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO> {
    const { url, recipeId, allergies, tokens } = context;

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
        const captionResult = await downloadCaptions(url, tokens);

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

        const result = await extractRecipeFromVideo(
          combinedCaptionAndDescription,
          metadata,
          recipeId,
          url,
          allergies
        );

        if (result.success) {
          log.info({ url }, "Successfully extracted recipe from captions + description");
          const savedVideo = videoPath
            ? await this.saveVideo(videoPath, recipeId, metadata.duration)
            : null;

          return this.addVideoToRecipe(result.data, savedVideo);
        }

        log.info({ url }, "Caption/description extraction failed, falling back to transcription");
      }

      // Fall back to audio transcription
      audioPath = await this.downloadAudio(url, tokens);
      log.info({ url }, "Starting audio transcription");

      const transcriptionResult = await transcribeAudio(audioPath);

      if (!transcriptionResult.success) {
        throw new Error(transcriptionResult.error);
      }

      const transcript = transcriptionResult.data;

      log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

      // Combine transcript with description
      const combinedTranscriptAndDescription = [transcript, descriptionText]
        .filter(Boolean)
        .join("\n\n---\n\n");

      const result = await extractRecipeFromVideo(
        combinedTranscriptAndDescription,
        metadata,
        recipeId,
        url,
        allergies
      );

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
      await this.cleanup(audioPath, captionPath);
      if (videoPath?.includes("video-temp")) {
        await this.cleanup(videoPath);
      }
    }
  }
}
