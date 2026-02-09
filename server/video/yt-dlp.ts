import type { VideoMetadata } from "./types";
import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

import YTDlpWrapModule from "yt-dlp-wrap";

// Handle CJS/ESM interop - the module may be wrapped in a default property
const YTDlpWrap =
  (YTDlpWrapModule as unknown as { default?: typeof YTDlpWrapModule }).default ?? YTDlpWrapModule;

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

export const DOWNLOAD_VIDEO_FORMAT_SELECTOR =
  "best[ext=mp4]/bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";

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

/**
 * Build additional yt-dlp args for auth tokens.
 * Header tokens become --add-header flags.
 * Cookie tokens are written to a temporary Netscape cookie file and referenced via --cookies.
 * Returns the extra args and a cleanup function for the temp cookie file.
 */
export async function buildAuthArgs(
  tokens: SiteAuthTokenDecryptedDto[],
  url: string
): Promise<{ args: string[]; cleanup: () => Promise<void> }> {
  const args: string[] = [];
  let cookieFilePath: string | null = null;

  const headerTokens = tokens.filter((t) => t.type === "header");

  for (const token of headerTokens) {
    args.push("--add-header", `${token.name}: ${token.value}`);
  }

  const cookieTokens = tokens.filter((t) => t.type === "cookie");

  if (cookieTokens.length > 0) {
    let domain: string;

    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }

    // Write Netscape cookie file format
    const lines = ["# Netscape HTTP Cookie File", "# https://curl.se/docs/http-cookies.html", ""];

    for (const token of cookieTokens) {
      // Format: domain  flag  path  secure  expiry  name  value
      lines.push(`${domain}\tTRUE\t/\tFALSE\t0\t${token.name}\t${token.value}`);
    }

    cookieFilePath = path.join(
      os.tmpdir(),
      `norish-cookies-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`
    );
    await fs.writeFile(cookieFilePath, lines.join("\n"), "utf-8");
    args.push("--cookies", cookieFilePath);
  }

  const cleanup = async () => {
    if (cookieFilePath) {
      await fs.unlink(cookieFilePath).catch(() => {});
    }
  };

  return { args, cleanup };
}

export async function getVideoMetadata(
  url: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<VideoMetadata> {
  await ensureYtDlpBinary();
  const ytDlpWrap = new YTDlpWrap(ytDlpPath);

  const auth = tokens?.length ? await buildAuthArgs(tokens, url) : null;

  try {
    const rawInfo = auth
      ? await ytDlpWrap.getVideoInfo([url, ...auth.args])
      : await ytDlpWrap.getVideoInfo(url);

    // yt-dlp returns an array for Instagram carousel/image posts (one entry per image)
    // For single videos, it returns an object directly
    // Normalize to always work with the first/main entry
    const info = Array.isArray(rawInfo) ? (rawInfo[0] ?? {}) : rawInfo;

    return {
      title: info.title || "Untitled Video",
      description: info.description || "",
      duration: info.duration || 0,
      thumbnail: info.thumbnail || "",
      uploader: info.uploader || info.channel || undefined,
      uploadDate: info.upload_date || undefined,
    };
  } catch (error: unknown) {
    log.error({ err: error }, "Failed to get video metadata");

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Provide more specific error messages
    if (errorMessage.includes("Unsupported URL")) {
      throw new Error("Video platform not supported or URL is invalid.");
    }
    if (errorMessage.includes("Video unavailable") || errorMessage.includes("private")) {
      throw new Error("Video is unavailable or private.");
    }
    if (errorMessage.includes("Sign in to confirm")) {
      throw new Error("Video requires authentication or age verification.");
    }

    throw new Error(`Failed to fetch video information: ${errorMessage}`);
  } finally {
    await auth?.cleanup();
  }
}

export async function downloadVideoAudio(
  url: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<string> {
  await ensureYtDlpBinary();
  await fs.mkdir(outputDir, { recursive: true });

  const ytDlpWrap = new YTDlpWrap(ytDlpPath);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const outputFile = path.join(outputDir, `audio-${timestamp}-${randomId}.wav`);

  const auth = tokens?.length ? await buildAuthArgs(tokens, url) : null;

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
      ...(auth?.args ?? []),
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
      await fs.unlink(outputFile).catch(() => {});
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
  } finally {
    await auth?.cleanup();
  }
}

export async function validateVideoLength(
  url: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<void> {
  const metadata = await getVideoMetadata(url, tokens);
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

export interface CaptionResult {
  /** Path to the downloaded caption file (VTT format) */
  filePath: string | null;
  /** Whether captions were found and downloaded */
  found: boolean;
}

/**
 * Download auto-generated captions/subtitles for a video.
 * Returns the path to the VTT file if available, null otherwise.
 */
export async function downloadCaptions(
  url: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<CaptionResult> {
  await ensureYtDlpBinary();
  await fs.mkdir(outputDir, { recursive: true });

  const ytDlpWrap = new YTDlpWrap(ytDlpPath);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const outputTemplate = path.join(outputDir, `caption-${timestamp}-${randomId}`);

  const auth = tokens?.length ? await buildAuthArgs(tokens, url) : null;

  try {
    const args = [
      url,
      "--write-auto-sub", // Download auto-generated subtitles
      "--skip-download", // Don't download the video itself
      "--convert-subs",
      "vtt", // Convert to VTT format
      "-o",
      outputTemplate,
      "--extractor-args",
      "youtube:player_client=default",
      ...(auth?.args ?? []),
    ];

    await ytDlpWrap.execPromise(args);

    // Find the downloaded VTT file (yt-dlp adds language suffix)
    const files = await fs.readdir(outputDir);
    const captionFile = files.find(
      (f) => f.startsWith(`caption-${timestamp}-${randomId}`) && f.endsWith(".vtt")
    );

    if (captionFile) {
      const filePath = path.join(outputDir, captionFile);

      log.info({ filePath }, "Captions downloaded successfully");

      return { filePath, found: true };
    }

    log.debug({ url }, "No captions found for video");

    return { filePath: null, found: false };
  } catch (error: unknown) {
    // Captions not available is not an error - just means we'll use audio transcription
    log.debug({ url, err: error }, "Could not download captions (may not be available)");

    return { filePath: null, found: false };
  } finally {
    await auth?.cleanup();
  }
}

/**
 * Parse VTT caption file and extract plain text content.
 * Removes timestamps, cue identifiers, and formatting tags.
 */
export async function parseVttFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");

  return parseVttContent(content);
}

/**
 * Parse VTT content string and extract plain text.
 */
export function parseVttContent(content: string): string {
  const lines = content.split("\n");
  const textLines: string[] = [];
  let inCue = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header and empty lines
    if (trimmed === "WEBVTT" || trimmed === "") {
      inCue = false;
      continue;
    }

    // Skip timestamp lines (e.g., "00:00:00.000 --> 00:00:05.000")
    if (trimmed.includes("-->")) {
      inCue = true;
      continue;
    }

    // Skip cue identifiers (numeric or named)
    if (/^\d+$/.test(trimmed) || /^[a-zA-Z0-9-_]+$/.test(trimmed)) {
      continue;
    }

    // If we're in a cue, this is caption text
    if (inCue) {
      // Remove VTT formatting tags like <c>, </c>, <b>, etc.
      const cleanText = trimmed
        .replace(/<[^>]+>/g, "") // Remove HTML-like tags
        .replace(/&nbsp;/g, " ") // Replace non-breaking spaces
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

      if (cleanText && !textLines.includes(cleanText)) {
        textLines.push(cleanText);
      }
    }
  }

  return textLines.join(" ");
}

export interface DownloadedVideo {
  /** Path to the downloaded video file */
  filePath: string;
  /** Original extension from yt-dlp */
  extension: string;
}

/**
 * Download video file from URL using yt-dlp.
 * Returns the path to the downloaded file in a temp directory.
 * The caller is responsible for cleanup.
 */
export async function downloadVideo(
  url: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<DownloadedVideo> {
  await ensureYtDlpBinary();
  await fs.mkdir(outputDir, { recursive: true });

  const ytDlpWrap = new YTDlpWrap(ytDlpPath);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  // Use a template that yt-dlp will fill in with the actual extension
  const outputTemplate = path.join(outputDir, `video-${timestamp}-${randomId}.%(ext)s`);

  const auth = tokens?.length ? await buildAuthArgs(tokens, url) : null;

  try {
    const ffmpegBinary = getFfmpegPath();
    const ffmpegDir = ffmpegBinary ? path.dirname(ffmpegBinary) : undefined;

    log.debug({ ffmpegDir, ffmpegBinary }, "Using ffmpeg for video download");

    const args = [
      url,
      "-o",
      outputTemplate,
      // Prefer progressive MP4 first, then H.264 MP4 DASH, then generic MP4
      "-f",
      DOWNLOAD_VIDEO_FORMAT_SELECTOR,
      "--extractor-args",
      "youtube:player_client=default",
      ...(auth?.args ?? []),
    ];

    // Add ffmpeg location if available
    if (ffmpegDir) {
      args.push("--ffmpeg-location", ffmpegDir);
    }

    await ytDlpWrap.execPromise(args);

    // Find the actual output file (yt-dlp fills in the extension)
    const basePattern = `video-${timestamp}-${randomId}`;
    const files = await fs.readdir(outputDir);
    const downloadedFile = files.find((f) => f.startsWith(basePattern));

    if (!downloadedFile) {
      throw new Error("Video file not found after download");
    }

    const filePath = path.join(outputDir, downloadedFile);
    const extension = path.extname(downloadedFile).toLowerCase();

    // Verify file exists and has content
    const stats = await fs.stat(filePath);

    if (stats.size === 0) {
      await fs.unlink(filePath).catch(() => {});
      throw new Error("Downloaded video file is empty");
    }

    log.info({ filePath, extension, size: stats.size }, "Video downloaded successfully");

    return { filePath, extension };
  } catch (error: any) {
    log.error({ err: error }, "Failed to download video");

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
  } finally {
    await auth?.cleanup();
  }
}

export { getFfmpegPath };
