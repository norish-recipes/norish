import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import type { VideoProcessorContext } from "../types";

import { InstagramProcessor } from "./instagram";

import { videoLogger as log } from "@/server/logger";

/**
 * Facebook video processor.
 * Mirrors Instagram behavior: OCR + description for images, transcription fallback for videos.
 */
export class FacebookProcessor extends InstagramProcessor {
  override readonly name = "FacebookProcessor";

  override async process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO> {
    log.info({ url: context.url }, "Processing Facebook post (using Instagram logic)");

    return super.process(context);
  }
}
