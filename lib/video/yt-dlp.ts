import type { VideoMetadata } from "./types";

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import YTDlpWrap from "yt-dlp-wrap";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { getVideoConfig } from "@/config/server-config-loader";
import { videoLogger as log } from "@/server/logger";

// Resolve ffmpeg path at runtime
// In production (Docker), uses system ffmpeg from Alpine packages
// In development, uses ffmpeg-static npm package
function getFfmpegPath(): string | null {
  const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  // Method 1: Check if system ffmpeg is available (production Docker)
  try {
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

const ytDlpFilename = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

// In production (Docker), binary is pre-downloaded during build to /app/bin
// In development, download to current directory on first use
const ytDlpPath = path.resolve(SERVER_CONFIG.YT_DLP_BIN_DIR, ytDlpFilename);
const outputDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "video-temp");

export async function ensureYtDlpBinary(): Promise<void> {
  log.debug({ ytDlpPath }, "Checking for binary");
  try {
    await fs.access(ytDlpPath);
    log.debug({ ytDlpPath }, "Binary found");

    return; // Binary exists, we're good
  } catch (_error) {
    // Binary doesn't exist
    log.error({ ytDlpPath }, "Binary NOT found");
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `yt-dlp binary not found at ${ytDlpPath}. It should be pre-downloaded during Docker build.`
      );
    }

    try {
      const ytDlpVersion = SERVER_CONFIG.YT_DLP_VERSION;

      await YTDlpWrap.downloadFromGithub(ytDlpPath, ytDlpVersion, process.platform);

      if (process.platform !== "win32") {
        await fs.chmod(ytDlpPath, 0o755);
      }
    } catch (_downloadError) {
      throw new Error("Failed to download yt-dlp binary. Video processing is unavailable.");
    }
  }
}

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  const ytDlpWrap = new YTDlpWrap(ytDlpPath);

  try {
    const info = await ytDlpWrap.getVideoInfo(url);

    return {
      title: info.title || "Untitled Video",
      description: info.description || "",
      duration: info.duration || 0,
      thumbnail: info.thumbnail || "",
      uploader: info.uploader || info.channel || undefined,
      uploadDate: info.upload_date || undefined,
    };
  } catch (error: any) {
    log.error({ err: error }, "Failed to get video metadata");

    // Provide more specific error messages
    if (error.message?.includes("Unsupported URL")) {
      throw new Error("Video platform not supported or URL is invalid.");
    }
    if (error.message?.includes("Video unavailable") || error.message?.includes("private")) {
      throw new Error("Video is unavailable or private.");
    }
    if (error.message?.includes("Sign in to confirm")) {
      throw new Error("Video requires authentication or age verification.");
    }

    const errorMessage = error.message || "Unknown error";

    throw new Error(`Failed to fetch video information: ${errorMessage}`);
  }
}

export async function downloadVideoAudio(url: string): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });

  const ytDlpWrap = new YTDlpWrap(ytDlpPath);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const outputFile = path.join(outputDir, `audio-${timestamp}-${randomId}.wav`);

  try {
    // Download video and extract audio as WAV format
    const ffmpegBinary = getFfmpegPath();
    const ffmpegDir = ffmpegBinary ? path.dirname(ffmpegBinary) : undefined;

    log.debug({ ffmpegDir, ffmpegBinary }, "Using ffmpeg for audio extraction");

    const args = [
      url,
      "-x", // Extract audio
      "--audio-format",
      "wav", // Convert to WAV
      "--audio-quality",
      "0", // Best quality
      "-o",
      outputFile, // Output file
      "--extractor-args",
      "youtube:player_client=default", // Suppress JS runtime warning
    ];

    // Add ffmpeg location if available
    if (ffmpegDir) {
      args.push("--ffmpeg-location", ffmpegDir);
    }

    await ytDlpWrap.execPromise(args);
    try {
      await fs.stat(outputFile);
    } catch {
      throw new Error("Could not create audio file.");
    }

    return outputFile;
  } catch (error: any) {
    log.error({ err: error }, "Failed to download video audio");

    // Cleanup on failure
    try {
      await fs.unlink(outputFile).catch(() => { });
    } catch (cleanupErr) {
      log.error({ err: cleanupErr }, "Failed to cleanup temp file");
    }

    if (error.message?.includes("Unsupported URL")) {
      throw new Error("Video platform not supported or URL is invalid.");
    }
    if (error.message?.includes("Video unavailable") || error.message?.includes("private")) {
      throw new Error("Video is unavailable or private.");
    }
    if (error.message?.includes("HTTP Error 429")) {
      throw new Error("Rate limited by video platform. Please try again later.");
    }

    const errorMessage = error.message || "Unknown error";

    throw new Error(`Failed to download video: ${errorMessage}`);
  }
}

export async function validateVideoLength(url: string): Promise<void> {
  const metadata = await getVideoMetadata(url);
  const videoConfig = await getVideoConfig();
  const maxLength = videoConfig?.maxLengthSeconds ?? SERVER_CONFIG.VIDEO_MAX_LENGTH_SECONDS;

  if (metadata.duration > maxLength) {
    const actualMinutes = Math.floor(metadata.duration / 60);
    const actualSeconds = metadata.duration % 60;
    const maxMinutes = Math.floor(maxLength / 60);
    const maxSeconds = maxLength % 60;

    const maxTime = `${maxMinutes}:${maxSeconds.toString().padStart(2, "0")}`;
    const actualTime = `${actualMinutes}:${actualSeconds.toString().padStart(2, "0")}`;

    throw new Error(`Video exceeds maximum length of ${maxTime} (actual: ${actualTime})`);
  }
}
