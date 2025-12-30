import fs from "node:fs/promises";
import path from "node:path";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { videoLogger as log } from "@/server/logger";

export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (_error: any) {
    // Ignore if file doesn't exist
  }
}

export async function cleanupFiles(filePaths: string[]): Promise<void> {
  await Promise.all(filePaths.map(cleanupFile));
}

export async function cleanupOldTempFiles(maxAgeMs: number = 60 * 60 * 1000): Promise<void> {
  const tempDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "video-temp");

  try {
    await fs.mkdir(tempDir, { recursive: true });

    const files = await fs.readdir(tempDir);
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);

      try {
        const stats = await fs.stat(filePath);

        if (!stats.isFile()) continue;

        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      } catch (error: any) {
        log.warn({ err: error, filePath }, "Failed to process file");
      }
    }

    if (cleanedCount > 0) {
      log.info({ cleanedCount }, `Removed ${cleanedCount} old temporary file(s)`);
    }
  } catch (error: any) {
    log.error({ err: error }, "Failed to cleanup old temp files");
  }
}

export async function initializeCleanup(): Promise<void> {
  await cleanupOldTempFiles();
}
