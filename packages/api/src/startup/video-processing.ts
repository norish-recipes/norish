import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { videoLogger } from "@norish/shared-server/logger";

export async function initializeVideoProcessing(): Promise<void> {
  if (!SERVER_CONFIG.VIDEO_PARSING_ENABLED) {
    return;
  }

  const { ensureYtDlpBinary } = await import("@norish/api/video/yt-dlp");
  const { initializeCleanup } = await import("@norish/api/video/cleanup");

  await ensureYtDlpBinary();
  await initializeCleanup();

  videoLogger.info("Video processing initialized");
}
