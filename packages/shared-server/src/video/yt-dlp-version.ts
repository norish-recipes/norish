/**
 * The yt-dlp release this server is actually running.
 *
 * A report, not a setting. Production fixes the binary at image build time and
 * development downloads it once, when it is absent — so no Norish setting can
 * change which release answers here, and the only honest way to know is to ask
 * the binary.
 */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { videoLogger as log } from "@norish/shared-server/logger";

const execFileAsync = promisify(execFile);

const ytDlpFilename = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

/**
 * Ask the downloader binary which release it is.
 *
 * Null when there is no binary to ask — a development server that has not
 * imported anything yet, or an image built without one. Callers must say so
 * plainly rather than showing "unknown" where a version belongs.
 */
export async function getYtDlpVersion(): Promise<string | null> {
  const ytDlpPath = path.resolve(SERVER_CONFIG.YT_DLP_BIN_DIR, ytDlpFilename);

  try {
    const { stdout } = await execFileAsync(ytDlpPath, ["--version"], { windowsHide: true });

    return stdout.trim() || null;
  } catch (err) {
    log.debug({ err, ytDlpPath }, "Could not ask yt-dlp for its version");

    return null;
  }
}
