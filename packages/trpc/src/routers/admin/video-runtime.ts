import { trpcLogger as log } from "@norish/shared-server/logger";
import { getYtDlpVersion as readYtDlpVersion } from "@norish/shared-server/video/yt-dlp-version";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Report which yt-dlp release this server is running.
 *
 * Deliberately not part of the video config: production fixes the binary at
 * image build time and development downloads it once, when it is absent, so no
 * setting can change the answer. `null` means there is no binary to ask, which
 * the screen must say plainly rather than showing as a version.
 */
const getYtDlpVersion = adminProcedure.query(async ({ ctx }) => {
  const version = await readYtDlpVersion();

  log.debug({ userId: ctx.user.id, version }, "Reporting yt-dlp version");

  return { version };
});

export const videoRuntimeProcedures = router({
  getYtDlpVersion,
});
