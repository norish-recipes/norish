import { SERVER_CONFIG } from "@/config/env-config-server";
import { videoLogger } from "@/server/logger";

export async function initializeVideoProcessing(): Promise<void> {
  if (!SERVER_CONFIG.VIDEO_PARSING_ENABLED) {
    return;
  }

  const { ensureYtDlpBinary } = await import("@/server/video/yt-dlp");
  const { initializeCleanup } = await import("@/server/video/cleanup");

  await ensureYtDlpBinary();
  await initializeCleanup();

  videoLogger.info("Video processing initialized");
}
