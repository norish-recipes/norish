import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import type { VideoProcessor, VideoProcessorContext, VideoMetadata } from "./types";
import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

import { videoLogger as log } from "@/server/logger";
import { cleanupFile } from "@/server/video/cleanup";
import {
  downloadVideo,
  downloadVideoAudio,
  validateVideoLength,
  getVideoMetadata,
  getFfmpegPath,
} from "@/server/video/yt-dlp";
import { convertToMp4, saveVideoFile } from "@/server/downloader";

/**
 * Saved video result with path and duration.
 */
export interface SavedVideo {
  video: string;
  duration: number | null;
}

/**
 * Abstract base class for video processors.
 * Provides common utilities for downloading, saving, and cleaning up videos.
 */
export abstract class BaseVideoProcessor implements VideoProcessor {
  abstract readonly name: string;

  abstract process(context: VideoProcessorContext): Promise<FullRecipeInsertDTO>;

  /**
   * Get video metadata from URL.
   */
  protected async getMetadata(
    url: string,
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<VideoMetadata> {
    return getVideoMetadata(url, tokens);
  }

  /**
   * Validate video length against configured maximum.
   */
  protected async validateLength(url: string, tokens?: SiteAuthTokenDecryptedDto[]): Promise<void> {
    await validateVideoLength(url, tokens);
  }

  /**
   * Download video file and convert to MP4 if needed.
   * Returns the file path or null if download fails.
   */
  protected async downloadAndConvertVideo(
    url: string,
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<string | null> {
    try {
      log.info({ url }, "Downloading video file");
      const downloadedVideo = await downloadVideo(url, tokens);

      const ffmpegPath = getFfmpegPath();
      const convertResult = await convertToMp4(downloadedVideo.filePath, ffmpegPath);

      log.info(
        { method: convertResult.method, converted: convertResult.converted },
        "Video conversion complete"
      );

      return convertResult.filePath;
    } catch (err) {
      log.warn({ err }, "Failed to download/convert video file");

      return null;
    }
  }

  /**
   * Download audio from video for transcription.
   */
  protected async downloadAudio(
    url: string,
    tokens?: SiteAuthTokenDecryptedDto[]
  ): Promise<string> {
    return downloadVideoAudio(url, tokens);
  }

  /**
   * Save video file to recipe directory.
   */
  protected async saveVideo(
    videoPath: string,
    recipeId: string,
    duration: number | undefined
  ): Promise<SavedVideo | null> {
    try {
      const savedVideo = await saveVideoFile(videoPath, recipeId, duration);

      log.info({ video: savedVideo.video }, "Video saved to recipe directory");

      return savedVideo;
    } catch (err) {
      log.warn({ err }, "Failed to save video file");

      return null;
    }
  }

  /**
   * Cleanup temporary files.
   */
  protected async cleanup(...paths: (string | null | undefined)[]): Promise<void> {
    for (const path of paths) {
      if (path) {
        await cleanupFile(path);
      }
    }
  }

  /**
   * Add saved video to recipe if available.
   */
  protected addVideoToRecipe(
    recipe: FullRecipeInsertDTO,
    savedVideo: SavedVideo | null
  ): FullRecipeInsertDTO {
    if (savedVideo) {
      recipe.videos = [{ video: savedVideo.video, duration: savedVideo.duration ?? 0, order: 0 }];
    }

    return recipe;
  }
}
