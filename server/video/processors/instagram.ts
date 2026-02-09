import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import type { VideoProcessorContext, VideoMetadata } from "../types";
import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

import { BaseVideoProcessor } from "../base-processor";

import { videoLogger as log } from "@/server/logger";
import { transcribeAudio } from "@/server/ai/transcriber";
import { extractRecipeFromVideo } from "@/server/video/normalizer";
import { extractRecipeWithAI } from "@/server/ai/recipe-parser";
import { downloadImage } from "@/server/downloader";
import { fetchViaPlaywright } from "@/server/parser/fetch";

/**
 * Check if metadata indicates an image post (no video content).
 */
function isImagePost(metadata: VideoMetadata): boolean {
  return !metadata.duration || metadata.duration === 0;
}

/**
 * Extract caption/description from Instagram/Facebook page HTML.
 */
function extractCaptionFromHtml(html: string): string {
  // Try meta description first
  const metaMatch = html.match(
    /<meta\s+(?:name|property)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i
  );

  if (metaMatch?.[1]) {
    const decoded = metaMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");

    if (decoded.length > 50) {
      return decoded;
    }
  }

  // Try alternate meta tag format
  const altMetaMatch = html.match(
    /<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["'](?:og:description|description)["']/i
  );

  if (altMetaMatch?.[1]) {
    const decoded = altMetaMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");

    if (decoded.length > 50) {
      return decoded;
    }
  }

  return "";
}

/**
 * Instagram video processor.
 * For images: OCR + description merged, sent to AI.
 * For videos: Try description first, fallback to transcription.
 */
export class InstagramProcessor extends BaseVideoProcessor {
  readonly name: string = "InstagramProcessor";

  async process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO> {
    const { url, recipeId, allergies, tokens } = context;

    log.info({ url }, "Processing Instagram post");

    const metadata = await this.getMetadata(url, tokens);

    if (isImagePost(metadata)) {
      return this.processImagePost(url, recipeId, metadata, allergies, tokens);
    }

    return this.processVideoPost(url, recipeId, metadata, allergies, tokens);
  }

  /**
   * Process an Instagram image post.
   * Uses AI vision for OCR + description extraction.
   */
  private async processImagePost(
    url: string,
    recipeId: string,
    metadata: VideoMetadata,
    allergies?: string[],
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<FullRecipeInsertDTO> {
    log.info({ url }, "Detected Instagram image post");

    let description = metadata.description?.trim() || "";

    // If yt-dlp returned empty description, try fetching via Playwright
    if (description.length < 50) {
      log.info({ url }, "Description too short, attempting Playwright scrape");
      try {
        const html = await fetchViaPlaywright(url, tokens);

        if (html) {
          description = extractCaptionFromHtml(html);
          log.info(
            { url, descriptionLength: description.length },
            "Extracted caption via Playwright"
          );
        }
      } catch (err) {
        log.warn({ url, err }, "Failed to fetch page via Playwright");
      }
    }

    if (!description || description.length < 50) {
      throw new Error("Instagram image posts are only supported if the caption contains a recipe");
    }

    // Use AI to extract recipe from description
    const result = await extractRecipeWithAI(description, recipeId, url, allergies);

    if (!result.success) {
      log.warn({ url, error: result.error }, "AI extraction failed for Instagram image post");
      throw new Error("Instagram image posts are only supported if the caption contains a recipe");
    }

    const recipe = result.data;

    // Download thumbnail as recipe image
    if (metadata.thumbnail) {
      try {
        const imagePath = await downloadImage(metadata.thumbnail, recipeId);

        recipe.image = imagePath;
        recipe.images = [{ image: imagePath, order: 0 }];
      } catch {
        log.debug({ url }, "Failed to download Instagram thumbnail");
      }
    }

    log.info(
      { url, recipeName: recipe.name },
      "Successfully extracted recipe from Instagram image post"
    );

    return recipe;
  }

  /**
   * Process an Instagram video post.
   * Tries description first, falls back to audio transcription.
   */
  private async processVideoPost(
    url: string,
    recipeId: string,
    metadata: VideoMetadata,
    allergies?: string[],
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<FullRecipeInsertDTO> {
    let audioPath: string | null = null;
    let videoPath: string | null = null;

    try {
      log.info({ url }, "Processing Instagram video post");

      await this.validateLength(url, tokens);

      // Download video file
      videoPath = await this.downloadAndConvertVideo(url, tokens);

      // Try extraction from description first
      const descriptionText = metadata.description?.trim() || "";

      if (descriptionText.length > 200) {
        log.info(
          { url, contentLength: descriptionText.length },
          "Trying extraction from description first"
        );

        const result = await extractRecipeFromVideo(
          descriptionText,
          metadata,
          recipeId,
          url,
          allergies
        );

        if (result.success) {
          log.info({ url }, "Successfully extracted recipe from description");
          const savedVideo = videoPath
            ? await this.saveVideo(videoPath, recipeId, metadata.duration)
            : null;

          return this.addVideoToRecipe(result.data, savedVideo);
        }

        log.info({ url }, "Description extraction failed, falling back to transcription");
      }

      // Fall back to audio transcription
      try {
        audioPath = await this.downloadAudio(url, tokens);
      } catch (audioError) {
        // If audio download fails, try description-based extraction as last resort
        log.warn(
          { url, err: audioError },
          "Audio download failed, attempting description extraction"
        );

        if (descriptionText.length >= 50) {
          const result = await extractRecipeWithAI(descriptionText, recipeId, url, allergies);

          if (result.success) {
            const savedVideo = videoPath
              ? await this.saveVideo(videoPath, recipeId, metadata.duration)
              : null;

            return this.addVideoToRecipe(result.data, savedVideo);
          }
        }

        throw audioError;
      }

      log.info({ url }, "Starting audio transcription");
      const transcriptionResult = await transcribeAudio(audioPath);

      if (!transcriptionResult.success) {
        throw new Error(transcriptionResult.error);
      }

      const transcript = transcriptionResult.data;

      log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

      // Combine transcript with description
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
