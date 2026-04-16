import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { isVideoParsingEnabled } from "@norish/config/server-config-loader";
import { videoLogger as log } from "@norish/shared-server/logger";

import { VideoProcessorFactory } from "./processor-factory";
import { FacebookProcessor } from "./processors/facebook";
import { GenericVideoProcessor } from "./processors/generic";
import { InstagramProcessor } from "./processors/instagram";
import { YouTubeProcessor } from "./processors/youtube";

/**
 * Singleton factory instance with all processors registered.
 */
let factoryInstance: VideoProcessorFactory | null = null;

function getFactory(): VideoProcessorFactory {
  if (!factoryInstance) {
    factoryInstance = new VideoProcessorFactory();
    factoryInstance.registerProcessor("youtube", new YouTubeProcessor());
    factoryInstance.registerProcessor("instagram", new InstagramProcessor());
    factoryInstance.registerProcessor("facebook", new FacebookProcessor());
    factoryInstance.registerProcessor("generic", new GenericVideoProcessor());
  }

  return factoryInstance;
}

/**
 * Process a video URL and extract recipe data.
 * Routes to the appropriate platform-specific processor.
 */
export async function processVideoRecipe(
  url: string,
  recipeId: string,
  allergies?: string[],
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<FullRecipeInsertDTO> {
  const videoEnabled = await isVideoParsingEnabled();

  if (!videoEnabled) {
    throw new Error("AI features or video processing is not enabled.");
  }

  const factory = getFactory();
  const processor = factory.getProcessor(url);

  log.info({ url, processor: processor.name }, "Starting video recipe processing");

  try {
    return await processor.process({ url, recipeId, allergies, tokens });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    log.error({ err: error, processor: processor.name }, "Failed to process video");
    throw new Error(`Failed to process video recipe: ${errorMessage}`);
  }
}

// Re-export factory for testing
export { VideoProcessorFactory } from "./processor-factory";
