import type { VideoProcessor, VideoPlatform } from "./types";

import { detectPlatform } from "./url-utils";

/**
 * Factory for selecting the appropriate video processor based on URL.
 */
export class VideoProcessorFactory {
  private processors = new Map<VideoPlatform, VideoProcessor>();

  /**
   * Register a processor for a specific platform.
   */
  registerProcessor(platform: VideoPlatform, processor: VideoProcessor): void {
    this.processors.set(platform, processor);
  }

  /**
   * Get the appropriate processor for a URL.
   * Falls back to generic processor for unknown platforms.
   */
  getProcessor(url: string): VideoProcessor {
    const platform = detectPlatform(url);
    const processor = this.processors.get(platform);

    if (!processor) {
      throw new Error(`No processor registered for platform: ${platform}`);
    }

    return processor;
  }

  /**
   * Check if a processor is registered for a platform.
   */
  hasProcessor(platform: VideoPlatform): boolean {
    return this.processors.has(platform);
  }
}
