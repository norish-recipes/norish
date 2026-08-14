import fs from "node:fs/promises";
import path from "node:path";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { schedulerLogger } from "@norish/shared-server/logger";
import { isAvatarFilenameForUser } from "@norish/shared/lib/helpers";

function getAvatarsDiskDir() {
  return path.join(SERVER_CONFIG.UPLOADS_DIR, "avatars");
}

/**
 * Delete every avatar file belonging to a user except the given filenames.
 * ADR-0021: after an upload the kept set is the new file plus its immediate
 * predecessor; a delete keeps nothing.
 */
export async function sweepUserAvatars(
  userId: string,
  keep: readonly string[] = []
): Promise<void> {
  let files: string[];

  try {
    files = await fs.readdir(getAvatarsDiskDir());
  } catch {
    return;
  }

  const sweepable = files.filter(
    (file) => isAvatarFilenameForUser(file, userId) && !keep.includes(file)
  );

  for (const file of sweepable) {
    await deleteAvatarByFilename(file);
  }
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
