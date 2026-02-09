import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

export interface VideoMetadata {
  title: string;
  description: string;
  duration: number; // in seconds
  thumbnail: string;
  uploader?: string;
  uploadDate?: string;
}

/**
 * Context passed to video processors for recipe extraction.
 */
export interface VideoProcessorContext {
  url: string;
  recipeId: string;
  allergies?: string[];
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
