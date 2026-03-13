import fs from "node:fs/promises";
import path from "node:path";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { schedulerLogger } from "@norish/shared-server/logger";

function getAvatarsDiskDir() {
  return path.join(SERVER_CONFIG.UPLOADS_DIR, "avatars");
}

export async function deleteAvatarByFilename(filename: string | null | undefined): Promise<void> {
  if (!filename) {
    return;
  }

  const filePath = path.join(getAvatarsDiskDir(), filename);

  try {
    await fs.unlink(filePath);
    schedulerLogger.info({ filename }, "Deleted avatar");
  } catch (err) {
    schedulerLogger.warn({ err, filename }, "Could not delete avatar");
  }
}
