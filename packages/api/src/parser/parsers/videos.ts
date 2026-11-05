/**
 * Video parsing for JSON-LD recipe normalization.
 *
 * Handles Schema.org VideoObject structures found in recipe JSON-LD.
 * Downloads videos from contentUrl and saves them to the recipe directory.
 */

import fs from "fs/promises";
import * as cheerio from "cheerio";
import { decode } from "html-entities";

import {
  downloadVideo,
  getFfmpegPath,
  getMaxVideoLengthSeconds,
  getVideoMetadata,
} from "@norish/api/video/yt-dlp";
import { getPageRenderersConfig } from "@norish/shared-server/config/server-config-loader";
import { parserLogger } from "@norish/shared-server/logger";
import { convertToMp4, saveVideoFile } from "@norish/shared-server/media/storage";
import { isRefusedHost } from "@norish/shared-server/private-addresses";

const log = parserLogger.child({ module: "videos" });

export interface ParsedVideo {
  video: string;
  thumbnail: string | null;
  duration: number | null;
  order: number;
}

export interface VideoParseResult {
  videos: ParsedVideo[];
}

interface VideoObjectCandidate {
  contentUrl?: string;
  url?: string;
  thumbnailUrl?: string | string[];
  duration?: string;
  name?: string;
  description?: string;
}

/**
 * Parse ISO 8601 duration (PT1H30M15S) to seconds.
 */
function parseDuration(duration: unknown): number | null {
  if (typeof duration !== "string") return null;

  // Handle numeric strings (already in seconds)
  const numericValue = parseFloat(duration);

  if (!isNaN(numericValue) && !duration.startsWith("P")) {
    return numericValue;
  }

  // Parse ISO 8601 duration format
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);

  if (!match) return null;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseFloat(match[3] || "0");

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Extract the best thumbnail URL from VideoObject.
 */
function extractThumbnailUrl(thumbnailUrl: unknown): string | null {
  if (!thumbnailUrl) return null;

  if (typeof thumbnailUrl === "string") {
    return thumbnailUrl;
  }

  if (Array.isArray(thumbnailUrl)) {
    // Return first valid URL
    for (const url of thumbnailUrl) {
      if (typeof url === "string" && url.trim()) {
        return url.trim();
      }
    }
  }

  return null;
}

/**
 * Normalize a VideoObject node into a candidate for processing.
 */
function normalizeVideoObject(node: unknown): VideoObjectCandidate | null {
  if (!node || typeof node !== "object") return null;

  const obj = node as Record<string, unknown>;

  // Check @type is VideoObject (case-insensitive)
  const type = obj["@type"] ?? obj.type;
  const typeStr = Array.isArray(type) ? type.join(",").toLowerCase() : String(type).toLowerCase();

  if (!typeStr.includes("videoobject")) return null;

  const contentUrl = typeof obj.contentUrl === "string" ? obj.contentUrl : undefined;
  const url = typeof obj.url === "string" ? obj.url : undefined;

  // Must have at least one video URL
  if (!contentUrl && !url) return null;

  return {
    contentUrl,
    url,
    thumbnailUrl: obj.thumbnailUrl as string | string[] | undefined,
    duration: typeof obj.duration === "string" ? obj.duration : undefined,
    name: typeof obj.name === "string" ? decode(obj.name).trim() : undefined,
    description: typeof obj.description === "string" ? decode(obj.description).trim() : undefined,
  };
}

const MAX_PAGE_VIDEOS = 10;

/**
 * The videos a page embeds, absolute. Cleaning a page for a model drops these, and most iframes are
 * not recipe videos: the model picks from this list, and the list bounds what it can pick.
 */
export function extractPageVideos(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  const add = (value: string | undefined) => {
    if (!value) return;

    try {
      const { href, protocol } = new URL(value, pageUrl);

      if (protocol === "http:" || protocol === "https:") urls.add(href);
    } catch {
      // Not a URL.
    }
  };

  $('meta[property^="og:video"]').each((_, element) => {
    const property = $(element).attr("property");

    if (property === "og:video" || property?.endsWith("url")) add($(element).attr("content"));
  });
  $("video, video source, iframe").each((_, element) => {
    add($(element).attr("src") ?? $(element).attr("data-src") ?? $(element).attr("data-lazy-src"));
  });

  return [...urls].slice(0, MAX_PAGE_VIDEOS);
}

/** A video URL a page offers is untrusted: only a public web address reaches the download. */
async function isDownloadable(videoUrl: string, allowPrivateAddresses: boolean): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(videoUrl);

    return (
      (protocol === "http:" || protocol === "https:") &&
      !(await isRefusedHost(hostname, allowPrivateAddresses))
    );
  } catch {
    return false;
  }
}

/**
 * Extract VideoObject candidates from JSON-LD video field.
 */
function extractVideoCandidates(videoField: unknown): VideoObjectCandidate[] {
  if (!videoField) return [];

  const candidates: VideoObjectCandidate[] = [];

  // Handle array of video objects
  if (Array.isArray(videoField)) {
    for (const item of videoField) {
      const candidate = normalizeVideoObject(item);

      if (candidate) candidates.push(candidate);
    }
  } else {
    // Single video object
    const candidate = normalizeVideoObject(videoField);

    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

/**
 * Safely delete a file, ignoring errors if it doesn't exist.
 */
async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    log.debug({ filePath }, "Cleaned up temp file");
  } catch {
    // Ignore errors - file may already be deleted
  }
}

/**
 * Download a video from URL using yt-dlp.
 *
 * @param videoUrl - The video URL to download
 * @param recipeId - Recipe ID for storage
 * @param order - Order index for the video
 * @param thumbnailUrl - Optional thumbnail URL from JSON-LD
 * @param durationHint - Optional duration from JSON-LD
 * @returns Parsed video object or null on failure
 */
async function downloadAndSaveVideo(
  videoUrl: string,
  recipeId: string,
  order: number,
  thumbnailUrl: string | null,
  durationHint: number | null
): Promise<ParsedVideo | null> {
  let downloadedPath: string | null = null;
  let convertedPath: string | null = null;

  try {
    log.debug({ videoUrl, recipeId }, "Attempting to download video from JSON-LD");

    // The probe over the page's own claim: a page can call any video short.
    let duration = durationHint;

    try {
      const metadata = await getVideoMetadata(videoUrl);

      duration = metadata.duration ?? duration;
    } catch {
      // Metadata fetch failed, continue with what the page said
    }

    const maxLength = await getMaxVideoLengthSeconds();

    if (duration && duration > maxLength) {
      log.warn({ videoUrl, duration, maxLength }, "Video exceeds the maximum length, not saved");

      return null;
    }

    // Download the video
    const downloadResult = await downloadVideo(videoUrl);

    if (!downloadResult) {
      log.warn({ videoUrl }, "Failed to download video");

      return null;
    }

    downloadedPath = downloadResult.filePath;

    // Convert to MP4 if needed
    const ffmpegPath = getFfmpegPath();
    const converted = await convertToMp4(downloadResult.filePath, ffmpegPath);

    // Track converted path if different from download path
    if (converted.filePath !== downloadResult.filePath) {
      convertedPath = converted.filePath;
      // Original was already deleted by convertToMp4 on success
      downloadedPath = null;
    }

    // Save to recipe directory
    const savedVideo = await saveVideoFile(converted.filePath, recipeId, duration ?? undefined);

    log.info(
      { videoUrl, recipeId, video: savedVideo.video },
      "Video downloaded and saved from JSON-LD"
    );

    // Cleanup: delete the temp file after successful save
    // saveVideoFile copies the file, so we need to clean up the source
    if (convertedPath) {
      await cleanupFile(convertedPath);
      convertedPath = null;
    } else if (downloadedPath) {
      await cleanupFile(downloadedPath);
      downloadedPath = null;
    }

    return {
      video: savedVideo.video,
      thumbnail: thumbnailUrl,
      duration: savedVideo.duration,
      order,
    };
  } catch (error) {
    log.warn({ error, videoUrl }, "Failed to process video from JSON-LD");

    return null;
  } finally {
    // Cleanup any remaining temp files on error
    if (downloadedPath) {
      await cleanupFile(downloadedPath);
    }
    if (convertedPath) {
      await cleanupFile(convertedPath);
    }
  }
}

/**
 * Parse and download videos from JSON-LD video field.
 *
 * This function handles:
 * - Single VideoObject
 * - Array of VideoObject
 * - Direct contentUrl or url fields
 *
 * Videos are downloaded using yt-dlp and saved to the recipe directory.
 *
 * @param videoField - The video field from JSON-LD
 * @param recipeId - Recipe ID for storage paths
 * @param maxVideos - Maximum number of videos to process (default: 3)
 * @returns Parsed videos with paths and metadata
 */
export async function parseVideos(
  videoField: unknown,
  recipeId: string,
  maxVideos: number = 3
): Promise<VideoParseResult> {
  const defaultResult: VideoParseResult = { videos: [] };

  if (!videoField) return defaultResult;

  const candidates = extractVideoCandidates(videoField);

  if (candidates.length === 0) {
    log.debug("No valid VideoObject candidates found in JSON-LD");

    return defaultResult;
  }

  log.debug({ count: candidates.length }, "Found VideoObject candidates in JSON-LD");

  const { allowPrivateAddresses } = await getPageRenderersConfig();
  const videos: ParsedVideo[] = [];

  // Process videos sequentially to avoid overwhelming resources
  for (let i = 0; i < Math.min(candidates.length, maxVideos); i++) {
    const candidate = candidates[i];

    if (!candidate) {
      continue;
    }

    const videoUrl = candidate.contentUrl || candidate.url;

    if (!videoUrl) continue;

    if (!(await isDownloadable(videoUrl, allowPrivateAddresses))) {
      log.warn({ videoUrl }, "Refused to download a video from this address");
      continue;
    }

    const thumbnailUrl = extractThumbnailUrl(candidate.thumbnailUrl);
    const duration = parseDuration(candidate.duration);

    const parsed = await downloadAndSaveVideo(videoUrl, recipeId, i, thumbnailUrl, duration);

    if (parsed) {
      videos.push(parsed);
    }
  }

  return { videos };
}
