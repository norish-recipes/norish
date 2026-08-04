import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";

/**
 * What the downloader said about a post's video stream.
 *
 * `"unknown"` is an Unclassified Post: the downloader gave nothing to go on.
 * It is a third answer rather than a missing one, so that no caller can read
 * silence as absence the way the duration check did (#513).
 */
export type VideoStream = "present" | "absent" | "unknown";

export interface VideoMetadata {
  title: string;
  description: string;
  duration: number; // in seconds
  thumbnail: string;
  uploader?: string;
  uploadDate?: string;
  /** BCP-47 language code of the video's original audio (e.g. "en", "es") */
  language?: string;
  /** Whether the post carries a video stream, as reported by yt-dlp. */
  videoStream: VideoStream;
}

/**
 * Context passed to video processors for recipe extraction.
 */
export interface VideoProcessorContext {
  url: string;
  recipeId: string;
  tokens?: SiteAuthTokenDecryptedDto[];
}

/**
 * Interface for platform-specific video processors.
 * Each processor handles a specific platform's extraction strategy.
 */
export interface VideoProcessor {
  /**
   * Human-readable name of the processor for logging.
   */
  readonly name: string;

  /**
   * Process a video URL and extract recipe data.
   */
  process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO>;
}

/**
 * Supported video platforms.
 */
export type VideoPlatform = "instagram" | "facebook" | "youtube" | "generic";
