import { execFile, execSync } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getVideoConfig } from "@norish/shared-server/config/server-config-loader";
import { videoLogger as log } from "@norish/shared-server/logger";

import type { VideoMetadata, VideoStream } from "./types";
import { MediaUnavailableError } from "./errors";

const execFileAsync = promisify(execFile);

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
  "best[vcodec^=avc1][ext=mp4]/bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[ext=mp4]/best";

export const TRANSCRIPTION_AUDIO_FORMAT = "mp3";
export const TRANSCRIPTION_AUDIO_QUALITY = "64K";
export const TRANSCRIPTION_AUDIO_FALLBACKS = [
  { format: TRANSCRIPTION_AUDIO_FORMAT, quality: TRANSCRIPTION_AUDIO_QUALITY },
  { format: "m4a", quality: TRANSCRIPTION_AUDIO_QUALITY },
  { format: "wav", quality: "0" },
] as const;

// In production (Docker), binary is pre-downloaded during build to /app/bin
// In development, download to the configured runtime bin directory on first use
const ytDlpPath = path.resolve(SERVER_CONFIG.YT_DLP_BIN_DIR, ytDlpFilename);
const outputDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "video-temp");

async function execYtDlp(args: string[], cwd?: string): Promise<string> {
  try {
    // --dump-json prints a whole info dict per media entry, so a long playlist
    // answers with several megabytes on stdout.
    const { stdout } = await execFileAsync(ytDlpPath, args, {
      cwd,
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    });

    return stdout;
  } catch (error: unknown) {
    const childError = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
    const stderr = childError.stderr?.toString().trim();
    const stdout = childError.stdout?.toString().trim();
    const details = [childError.message];

    if (stderr) {
      details.push(`Stderr:\n${stderr}`);
    }

    if (stdout) {
      details.push(`Stdout:\n${stdout}`);
    }

    throw new Error(details.join("\n\n"));
  }
}

/**
 * Restate a failed download as "the media could not be had", keeping the
 * operator-facing wording yt-dlp's own diagnostics earned.
 */
function asMediaUnavailable(error: unknown): MediaUnavailableError {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Unsupported URL")) {
    return new MediaUnavailableError("Video platform not supported or URL is invalid.", {
      cause: error,
    });
  }
  if (message.includes("Video unavailable") || message.includes("private")) {
    return new MediaUnavailableError("Video is unavailable or private.", { cause: error });
  }
  if (message.includes("HTTP Error 429")) {
    return new MediaUnavailableError("Rate limited by video platform. Please try again later.", {
      cause: error,
    });
  }

  return new MediaUnavailableError(`Failed to download video: ${message || "Unknown error"}`, {
    cause: error,
  });
}

async function getProxyArgs(): Promise<string[]> {
  const videoConfig = await getVideoConfig();
  const proxy = videoConfig?.ytDlpProxy || SERVER_CONFIG.YT_DLP_PROXY;

  return proxy ? ["--proxy", proxy] : [];
}

/**
 * Fetch a yt-dlp release binary from GitHub into `targetPath`.
 *
 * Only a development server gets here - production ships the binary in the
 * image. The bytes land in a sibling temp file and are renamed into place, so
 * an interrupted download cannot leave a half-written binary for the next boot
 * to find and trust.
 */
async function downloadYtDlpBinary(targetPath: string, version: string): Promise<void> {
  const releasePath =
    version === "latest" ? "releases/latest/download" : `releases/download/${version}`;
  const url = `https://github.com/yt-dlp/yt-dlp/${releasePath}/${ytDlpFilename}`;

  log.debug({ url, targetPath }, "Downloading yt-dlp binary");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} ${response.statusText} for ${url}`);
  }

  const tempPath = `${targetPath}.download`;

  try {
    await fs.writeFile(tempPath, new Uint8Array(await response.arrayBuffer()));
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});

    throw error;
  }
}

export async function ensureYtDlpBinary(): Promise<void> {
  log.debug({ ytDlpPath }, "Checking for binary");
  await fs.mkdir(path.dirname(ytDlpPath), { recursive: true });

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

      await downloadYtDlpBinary(ytDlpPath, ytDlpVersion);

      if (process.platform !== "win32") {
        await fs.chmod(ytDlpPath, 0o755);
      }
    } catch (downloadError) {
      log.error({ err: downloadError, ytDlpPath }, "Could not download the yt-dlp binary");

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

  const parseHostname = (value: string): string => {
    try {
      return new URL(value).hostname;
    } catch {
      return value;
    }
  };

  const isIpAddress = (value: string): boolean =>
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(":");

  const toNetscapeDomain = (value: string): { domain: string; includeSubdomains: boolean } => {
    const normalized = parseHostname(value).trim().replace(/^\.+/, "").toLowerCase();

    if (!normalized || normalized === "localhost" || isIpAddress(normalized)) {
      return { domain: normalized || value, includeSubdomains: false };
    }

    return { domain: `.${normalized}`, includeSubdomains: true };
  };

  const headerTokens = tokens.filter((t) => t.type === "header");

  for (const token of headerTokens) {
    args.push("--add-header", `${token.name}: ${token.value}`);
  }

  const cookieTokens = tokens.filter((t) => t.type === "cookie");

  if (cookieTokens.length > 0) {
    let fallbackDomain: string;
    let secureFlag = "FALSE";

    try {
      const parsedUrl = new URL(url);

      fallbackDomain = parsedUrl.hostname;
      secureFlag = parsedUrl.protocol === "https:" ? "TRUE" : "FALSE";
    } catch {
      fallbackDomain = url;
    }

    // Write Netscape cookie file format
    const lines = ["# Netscape HTTP Cookie File", "# https://curl.se/docs/http-cookies.html", ""];

    for (const token of cookieTokens) {
      const { domain, includeSubdomains } = toNetscapeDomain(token.domain || fallbackDomain);

      // Format: domain  flag  path  secure  expiry  name  value
      lines.push(
        `${domain}\t${includeSubdomains ? "TRUE" : "FALSE"}\t/\t${secureFlag}\t0\t${token.name}\t${token.value}`
      );
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

/** The slice of yt-dlp's info dict this module reads. */
export type YtDlpInfo = {
  title?: string;
  description?: string;
  duration?: number | null;
  thumbnail?: string;
  uploader?: string;
  channel?: string;
  upload_date?: string;
  language?: string;
  vcodec?: string | null;
  ext?: string;
  formats?: { vcodec?: string | null }[];
  entries?: YtDlpInfo[];
};

/** Extensions yt-dlp reports for the still images of a photo or carousel post. */
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "gif"]);

/**
 * Ask yt-dlp for what it knows about a URL.
 *
 * `--dump-json` prints one info dict per media entry, so a playlist answers
 * with newline-delimited objects rather than a single document - both shapes
 * reach `toInfo`, which flattens them. `-f best` is what fills the top-level
 * `vcodec`, and that is how `videoStreamOf` tells a reel from a photo post.
 */
async function fetchVideoInfo(args: string[]): Promise<unknown> {
  const stdout = await execYtDlp([...args, "-f", "best", "--dump-json"]);

  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);
  }
}

function toInfo(rawInfo: unknown): YtDlpInfo {
  if (Array.isArray(rawInfo)) return { entries: rawInfo as YtDlpInfo[] };

  return (rawInfo ?? {}) as YtDlpInfo;
}

/**
 * What an info dict says about a video stream.
 *
 * `"unknown"` is the normal answer for a playlist wrapper, which knows nothing
 * about the media it wraps.
 */
export function videoStreamOf(info: YtDlpInfo): VideoStream {
  if (typeof info.vcodec === "string") return info.vcodec === "none" ? "absent" : "present";

  if (Array.isArray(info.formats) && info.formats.length > 0) {
    const known = info.formats.filter((format) => typeof format.vcodec === "string");

    if (known.length > 0) {
      return known.some((format) => format.vcodec !== "none") ? "present" : "absent";
    }
  }

  if (typeof info.ext === "string") {
    return IMAGE_EXTENSIONS.has(info.ext.toLowerCase()) ? "absent" : "present";
  }

  return "unknown";
}

/**
 * Collapse yt-dlp's answer to the entry that carries the media.
 *
 * The same reel comes back as the post itself, as a bare array, or wrapped in a
 * playlist, depending on the yt-dlp version and which extractor path ran - and
 * only the entry carries duration, uploader and thumbnail. Reading the wrapper
 * instead leaves a reel looking durationless and authorless, which downstream
 * mistook for an image post (#513). A carousel can mix stills and clips, so the
 * clip wins when there is one.
 */
export function selectMediaEntry(info: YtDlpInfo): YtDlpInfo {
  const entries = info.entries;

  if (!Array.isArray(entries) || entries.length === 0) return info;

  return entries.find((entry) => videoStreamOf(entry) === "present") ?? entries[0] ?? {};
}

export async function getVideoMetadata(
  url: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<VideoMetadata> {
  await ensureYtDlpBinary();

  const auth = tokens?.length ? await buildAuthArgs(tokens, url) : null;

  try {
    const proxyArgs = await getProxyArgs();
    const rawInfo = await fetchVideoInfo([url, ...(auth?.args ?? []), ...proxyArgs]);
    const container = toInfo(rawInfo);
    const primary = selectMediaEntry(container);

    // Read the media entry first and the wrapper second: a playlist carries the
    // caption and title, but only the entry knows the duration and uploader.
    const pick = <K extends keyof YtDlpInfo>(key: K): YtDlpInfo[K] =>
      primary[key] ?? container[key];

    // The wrapper only gets a say when the entry had none.
    const entryStream = videoStreamOf(primary);
    const videoStream: VideoStream =
      entryStream === "unknown" ? videoStreamOf(container) : entryStream;

    return {
      title: pick("title") || "Untitled Video",
      description: pick("description") || "",
      duration: pick("duration") || 0,
      thumbnail: pick("thumbnail") || "",
      uploader: pick("uploader") || pick("channel") || undefined,
      uploadDate: pick("upload_date") || undefined,
      language: pick("language") || undefined,
      videoStream,
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

  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const outputBase = `audio-${timestamp}-${randomId}`;
  const outputFiles = TRANSCRIPTION_AUDIO_FALLBACKS.map(({ format }) =>
    path.join(outputDir, `${outputBase}.${format}`)
  );

  const auth = tokens?.length ? await buildAuthArgs(tokens, url) : null;

  try {
    // Download video and extract compressed speech audio for transcription.
    const ffmpegBinary = getFfmpegPath();
    const ffmpegDir = ffmpegBinary ? path.dirname(ffmpegBinary) : undefined;

    log.debug({ ffmpegDir, ffmpegBinary }, "Using ffmpeg for audio extraction");
    const proxyArgs = await getProxyArgs();

    let lastError: unknown = null;

    for (const [index, attempt] of TRANSCRIPTION_AUDIO_FALLBACKS.entries()) {
      const outputFilename = `${outputBase}.${attempt.format}`;
      const outputFile = path.join(outputDir, outputFilename);
      const args = [
        url,
        "-x", // Extract audio
        "--audio-format",
        attempt.format,
        "--audio-quality",
        attempt.quality,
        "-o",
        outputFilename, // Output file, relative to outputDir
        "--extractor-args",
        "youtube:player_client=default", // Suppress JS runtime warning
        ...(auth?.args ?? []),
        ...proxyArgs,
      ];

      // Add ffmpeg location if available
      if (ffmpegDir) {
        args.push("--ffmpeg-location", ffmpegDir);
      }

      try {
        await execYtDlp(args, outputDir);

        const stats = await fs.stat(outputFile);

        log.info(
          { outputFile, size: stats.size, audioFormat: attempt.format, attempt: index + 1 },
          "Audio extracted for transcription"
        );

        return outputFile;
      } catch (error: unknown) {
        lastError = error;
        await fs.unlink(outputFile).catch(() => {});

        if (index < TRANSCRIPTION_AUDIO_FALLBACKS.length - 1) {
          const nextAttempt = TRANSCRIPTION_AUDIO_FALLBACKS[index + 1];

          log.warn(
            { err: error, audioFormat: attempt.format, nextFormat: nextAttempt?.format },
            "Audio extraction format failed, trying fallback"
          );
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Could not create audio file.");
  } catch (error: unknown) {
    log.error({ err: error }, "Failed to download video audio");

    // Cleanup on failure
    try {
      await Promise.all(outputFiles.map((outputFile) => fs.unlink(outputFile).catch(() => {})));
    } catch (cleanupErr) {
      log.error({ err: cleanupErr }, "Failed to cleanup temp file");
    }

    throw asMediaUnavailable(error);
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

    throw new MediaUnavailableError(
      `Video exceeds maximum length of ${maxTime} (actual: ${actualTime})`
    );
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
 *
 * @param subLang - BCP-47 language code to download subtitles for (e.g. "en", "es").
 *   Pass the `language` from the video's metadata to avoid an extra network call.
 *   Defaults to "en" if omitted.
 */
export async function downloadCaptions(
  url: string,
  tokens?: SiteAuthTokenDecryptedDto[],
  subLang?: string
): Promise<CaptionResult> {
  await ensureYtDlpBinary();
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const outputTemplate = `caption-${timestamp}-${randomId}`;

  const auth = tokens?.length ? await buildAuthArgs(tokens, url) : null;

  const resolvedSubLang = subLang ?? "en";

  log.debug({ subLang, resolvedSubLang, url }, "Using language for subtitle download");

  try {
    const args = [
      url,
      "--write-auto-sub", // Download auto-generated subtitles
      "--skip-download", // Don't download the video itself
      "--sub-langs",
      resolvedSubLang, // Use detected original language (fixes yt-dlp#13831)
      "--convert-subs",
      "vtt", // Convert to VTT format
      "-o",
      outputTemplate,
      "--extractor-args",
      "youtube:player_client=default",
      ...(auth?.args ?? []),
      ...(await getProxyArgs()),
    ];

    await execYtDlp(args, outputDir);

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

  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  // Use a template that yt-dlp will fill in with the actual extension
  const outputTemplate = `video-${timestamp}-${randomId}.%(ext)s`;

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
      ...(await getProxyArgs()),
    ];

    // Add ffmpeg location if available
    if (ffmpegDir) {
      args.push("--ffmpeg-location", ffmpegDir);
    }

    await execYtDlp(args, outputDir);

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
  } catch (error: unknown) {
    log.error({ err: error }, "Failed to download video");

    throw asMediaUnavailable(error);
  } finally {
    await auth?.cleanup();
  }
}

export { getFfmpegPath };
