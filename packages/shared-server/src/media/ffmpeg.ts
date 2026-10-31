import { execSync } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";

import { videoLogger as log } from "@norish/shared-server/logger";

// Resolve ffmpeg path at runtime
// In production (Docker), uses system ffmpeg from Alpine packages
// In development, uses ffmpeg-static npm package
export function getFfmpegPath(): string | null {
  const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  // Method 1: Check if system ffmpeg is available (production Docker)
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- finding ffmpeg on PATH is the point of this lookup
    const systemPath = execSync("which ffmpeg", { encoding: "utf8" }).trim();

    if (systemPath && fsSync.existsSync(systemPath)) {
      log.debug({ ffmpegPath: systemPath }, "Found system ffmpeg");

      return systemPath;
    }
  } catch (_err) {
    // System ffmpeg not found, try npm package
  }

  // Method 2: Check standard node_modules location (development)
  const projectRoot = process.cwd();
  const standardPath = path.join(projectRoot, "node_modules", "ffmpeg-static", binaryName);

  if (fsSync.existsSync(standardPath)) {
    log.debug({ ffmpegPath: standardPath }, "Found ffmpeg via node_modules");

    return standardPath;
  }

  // Method 3: Scan pnpm directory for any ffmpeg-static version
  const pnpmDir = path.join(projectRoot, "node_modules", ".pnpm");

  if (fsSync.existsSync(pnpmDir)) {
    try {
      const entries = fsSync.readdirSync(pnpmDir);
      const ffmpegDir = entries.find((e) => e.startsWith("ffmpeg-static@"));

      if (ffmpegDir) {
        const pnpmPath = path.join(pnpmDir, ffmpegDir, "node_modules", "ffmpeg-static", binaryName);

        if (fsSync.existsSync(pnpmPath)) {
          log.debug({ ffmpegPath: pnpmPath }, "Found ffmpeg via pnpm");

          return pnpmPath;
        }
      }
    } catch (err) {
      log.debug({ err }, "pnpm directory scan failed");
    }
  }

  // Method 4: Try the default export from ffmpeg-static
  try {
    const ffmpegStatic = require("ffmpeg-static");

    if (typeof ffmpegStatic === "string" && fsSync.existsSync(ffmpegStatic)) {
      log.debug({ ffmpegPath: ffmpegStatic }, "Found ffmpeg via ffmpeg-static export");

      return ffmpegStatic;
    }
  } catch (err) {
    log.debug({ err }, "ffmpeg-static export failed");
  }

  // Method 5: Resolve package.json location
  try {
    const packageJsonPath = require.resolve("ffmpeg-static/package.json");
    const packageDir = path.dirname(packageJsonPath);
    const binaryPath = path.join(packageDir, binaryName);

    if (fsSync.existsSync(binaryPath)) {
      log.debug({ ffmpegPath: binaryPath }, "Found ffmpeg via package.json resolution");

      return binaryPath;
    }
  } catch (err) {
    log.debug({ err }, "ffmpeg-static package.json resolution failed");
  }

  log.error("ffmpeg binary not found - video processing will fail");

  return null;
}
