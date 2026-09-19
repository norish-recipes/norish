import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { fetchRenderedPage } from "@norish/api/parser/fetch";
import { isRecipe } from "@norish/api/parser/import-triage";
import { extractRecipeWithAI } from "@norish/api/parser/recipe-extraction";
import { extractRecipeFromVideo } from "@norish/api/video/normalizer";
import { transcribe } from "@norish/shared-server/ai/runtime/runtime";
import { videoLogger as log } from "@norish/shared-server/logger";
import { downloadImage } from "@norish/shared-server/media/storage";

import type { VideoMetadata, VideoProcessorContext } from "../types";
import { BaseVideoProcessor } from "../base-processor";
import { isMediaUnavailable } from "../errors";

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
 * Whether a caption holds a recipe worth extracting from. Import triage's
 * answer where a Decision Model is configured (ADR-0035); otherwise the
 * character count that has always stood in for the question, against the
 * floor the call site names. An empty caption holds nothing either way.
 */
async function captionHoldsRecipe(caption: string, minLength: number): Promise<boolean> {
  if (caption.length === 0) return false;

  return (await isRecipe(caption)) ?? caption.length >= minLength;
}

/**
 * Instagram video processor.
 * For images: OCR + description merged, sent to AI.
 * For videos: Try description first, fallback to transcription.
 */
export class InstagramProcessor extends BaseVideoProcessor {
  readonly name: string = "InstagramProcessor";

  async process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO> {
    const { url, recipeId, tokens } = context;

    log.info({ url }, "Processing Instagram post");

    const metadata = await this.getMetadata(url, tokens);

    if (metadata.videoStream === "absent") {
      return this.processImagePost(url, recipeId, metadata, tokens);
    }

    if (metadata.videoStream === "present") {
      return this.processVideoPost(url, recipeId, metadata, tokens);
    }

    // An Unclassified Post: yt-dlp said nothing either way, so the video path is
    // a guess worth making. It is only worth taking back if there turned out to
    // be no media here — a failing transcription or AI provider is a real
    // failure, and quietly answering it with a caption-only recipe would hide
    // the outage behind a thin recipe.
    try {
      return await this.processVideoPost(url, recipeId, metadata, tokens);
    } catch (err) {
      if (!isMediaUnavailable(err)) throw err;

      log.info({ url, err }, "Unclassified Instagram post had no media, trying caption");

      return this.processImagePost(url, recipeId, metadata, tokens);
    }
  }

  /**
   * Process an Instagram image post.
   * Uses AI vision for OCR + description extraction.
   */
  private async processImagePost(
    url: string,
    recipeId: string,
    metadata: VideoMetadata,
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<FullRecipeInsertDTO> {
    log.info({ url }, "Detected Instagram image post");

    let description = metadata.description?.trim() || "";
    let holdsRecipe = await captionHoldsRecipe(description, 50);

    // If yt-dlp returned no usable caption, render the post and read its caption
    if (!holdsRecipe) {
      log.info({ url }, "Description holds no recipe, rendering the post in Obscura");
      try {
        const html = await fetchRenderedPage(url, tokens);

        if (html) {
          description = extractCaptionFromHtml(html);
          log.info(
            { url, descriptionLength: description.length },
            "Extracted caption from the rendered page"
          );
          holdsRecipe = await captionHoldsRecipe(description, 50);
        }
      } catch (err) {
        log.warn({ url, err }, "Failed to render the post in Obscura");
      }
    }

    if (!holdsRecipe) {
      throw new Error("Instagram image posts are only supported if the caption contains a recipe");
    }

    // Use AI to extract recipe from description
    let recipe;

    try {
      recipe = await extractRecipeWithAI(description, recipeId, url);
    } catch (error) {
      log.warn({ url, err: error }, "AI extraction failed for Instagram image post");
      throw new Error("Instagram image posts are only supported if the caption contains a recipe");
    }

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
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<FullRecipeInsertDTO> {
    let audioPath: string | null = null;
    let videoPath: string | null = null;

    try {
      log.info({ url }, "Processing Instagram video post");

      await this.validateLength(url, tokens);

      // Download video file
      videoPath = await this.downloadAndConvertVideo(url, tokens);

      // Try extraction from description first, when the caption holds a
      // recipe: a Decision where there is a Decision Model, the length
      // otherwise. Cheaper than paying for a transcription that the caption
      // already answers.
      const descriptionText = metadata.description?.trim() || "";

      if (await captionHoldsRecipe(descriptionText, 201)) {
        log.info(
          { url, contentLength: descriptionText.length },
          "Trying extraction from description first"
        );

        // A failed description extraction is not terminal: the audio itself
        // is still there to transcribe.
        try {
          const recipe = await extractRecipeFromVideo(descriptionText, metadata, recipeId, url);

          log.info({ url }, "Successfully extracted recipe from description");
          const savedVideo = videoPath
            ? await this.saveVideo(videoPath, recipeId, metadata.duration)
            : null;

          return this.addVideoToRecipe(recipe, savedVideo);
        } catch (descriptionExtractionError) {
          log.info(
            { url, err: descriptionExtractionError },
            "Description extraction failed, falling back to transcription"
          );
        }
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

        if (await captionHoldsRecipe(descriptionText, 50)) {
          try {
            const recipe = await extractRecipeWithAI(descriptionText, recipeId, url);
            const savedVideo = videoPath
              ? await this.saveVideo(videoPath, recipeId, metadata.duration)
              : null;

            return this.addVideoToRecipe(recipe, savedVideo);
          } catch (descriptionError) {
            log.warn({ url, err: descriptionError }, "Description extraction failed too");
          }
        }

        throw audioError;
      }

      log.info({ url }, "Starting audio transcription");
      const transcript = await transcribe(audioPath);

      log.info({ url, transcriptLength: transcript.length }, "Audio transcribed");

      // Combine transcript with description
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
