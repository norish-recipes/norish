import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";

import { v5 as uuidv5 } from "uuid";
import sharp from "sharp";
import convert from "heic-convert";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { getMaxVideoFileSize } from "@/config/server-config-loader";
import { serverLogger as log } from "@/server/logger";

// TODO: This file needs a lot of cleaning up
// Lots of AI generated code to get heic-convert working.
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const CT_TO_EXT = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);

export type ImageCandidate = {
  url: string;
  width?: number;
  height?: number;
};

const RECIPES_BASE_DIR = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes");

// Configuration constants
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const FETCH_TIMEOUT = 30000; // 30 seconds
const JPEG_QUALITY = 80;

// --- Utility helpers ---

function area(c: ImageCandidate): number | undefined {
  return c.width && c.height ? c.width * c.height : undefined;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function extFromContentType(ct?: string | null): string | undefined {
  if (!ct) return undefined;
  const mime = ct.split(";", 1)[0].trim().toLowerCase();

  return CT_TO_EXT.get(mime);
}

function extFromUrl(u: string): string | undefined {
  try {
    const p = new URL(u);
    const ext = path.extname(p.pathname).toLowerCase();

    return ALLOWED_EXTS.has(ext) ? ext : undefined;
  } catch {
    return undefined;
  }
}

function extFromBuffer(buf: Buffer): string | undefined {
  if (buf.length < 12) return undefined;

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";

  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return ".png";

  // WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return ".webp";

  // AVIF / HEIC
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    const brand = buf.slice(8, 12).toString("ascii");

    if (brand === "avif") return ".avif";
    if (
      brand === "heic" ||
      brand === "mif1" ||
      brand === "msf1" ||
      brand.startsWith("hei") ||
      brand.startsWith("hev")
    ) {
      return ".heic";
    }
  }

  return undefined;
}

async function fileExists(fp: string): Promise<boolean> {
  try {
    await fs.access(fp);

    return true;
  } catch {
    return false;
  }
}

function deriveExtFromBytes(
  url: string,
  contentType: string | null | undefined,
  bytes: Buffer
): string {
  const ctExt = contentType ? extFromContentType(contentType) : undefined;

  if (ctExt) return ctExt;
  const sniff = extFromBuffer(bytes);

  if (sniff) return sniff;
  const urlExt = extFromUrl(url);

  if (urlExt) return urlExt;

  return ".jpg";
}

function uuidFromBytes(bytes: Buffer): string {
  const hashHex = crypto.createHash("sha256").update(bytes).digest("hex");

  return uuidv5(hashHex, uuidv5.URL);
}

function isValidImageBuffer(buffer: Buffer): boolean {
  // Minimum viable image size (header + some data)
  if (buffer.length < 100) return false;

  // Check for valid image signatures
  const ext = extFromBuffer(buffer);

  return ext !== undefined;
}

// --- Image normalization ---
async function convertToJpeg(buffer: Buffer, sourceExt: string): Promise<Buffer> {
  try {
    // Validate input buffer
    if (!isValidImageBuffer(buffer)) {
      throw new Error("Invalid or corrupted image buffer");
    }

    let intermediate = buffer;

    // Handle HEIC separately as it needs special conversion
    if (sourceExt === ".heic") {
      // heic-convert actually expects Uint8Array despite what the types say
      const inputBytes = new Uint8Array(buffer);

      const outputArrayBuffer = (await convert({
        buffer: inputBytes as unknown as ArrayBuffer,
        format: "JPEG",
        quality: 0.9,
      })) as ArrayBuffer;

      intermediate = Buffer.from(new Uint8Array(outputArrayBuffer));
    }

    // Get metadata before processing
    const metadata = await sharp(intermediate).metadata();

    // Check if image is already small enough
    const needsResize =
      (metadata.width && metadata.width > MAX_WIDTH) ||
      (metadata.height && metadata.height > MAX_HEIGHT);

    let sharpInstance = sharp(intermediate).rotate(); // Auto-rotate based on EXIF

    if (needsResize) {
      sharpInstance = sharpInstance.resize({
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const jpegBuffer = await sharpInstance
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: "4:2:0",
      })
      .toBuffer();

    const _outputMetadata = await sharp(jpegBuffer).metadata();

    return jpegBuffer;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);

    log.error({ err: e, sourceExt }, "Conversion failed");
    throw new Error(`Failed to convert ${sourceExt} to JPEG: ${errorMsg}`);
  }
}

// --- Fetch with timeout ---
async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    clearTimeout(timeoutId);

    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw e;
  }
}

// --- JSON-LD image normalization ---
export function normalizeJsonLdImages(imageField: any): ImageCandidate[] {
  if (!imageField) return [];

  const toCandidate = (node: any): ImageCandidate | null => {
    if (!node) return null;

    if (typeof node === "string") {
      try {
        return { url: new URL(node).toString() };
      } catch {
        // If it's not a valid URL, skip it
        return null;
      }
    }

    if (typeof node === "object") {
      const url =
        node.url || node.contentUrl || node["@id"] || node["@idUrl"] || node.src || node["@id:src"];

      if (!url) return null;

      const width = node.width ? Number(node.width) : undefined;
      const height = node.height ? Number(node.height) : undefined;

      let href = String(url);

      try {
        href = new URL(href).toString();
      } catch {
        // Invalid URL, skip it
        return null;
      }

      return { url: href, width, height };
    }

    return null;
  };

  const items = Array.isArray(imageField) ? imageField : [imageField];
  const result: ImageCandidate[] = [];

  items
    .filter((i) => i != null && i !== "")
    .forEach((i) => {
      const cand = toCandidate(i);

      if (cand) result.push(cand);
    });

  // Deduplicate by URL
  const seen = new Set<string>();

  return result.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);

    return true;
  });
}

// --- Core image save helper ---

interface SaveImageOptions {
  /** Directory to save the image in */
  directory: string;
  /** Web URL prefix for the saved image */
  webPrefix: string;
}

/**
 * Core helper to save image bytes to disk with normalization.
 * All image save functions should use this internally.
 */
async function saveImageBytesCore(bytes: Buffer, options: SaveImageOptions): Promise<string> {
  await ensureDir(options.directory);

  // Validate buffer size
  if (bytes.length > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
    throw new Error(
      `Image too large: ${bytes.length} bytes (max: ${SERVER_CONFIG.MAX_IMAGE_FILE_SIZE})`
    );
  }

  // Validate it's an image
  if (!isValidImageBuffer(bytes)) {
    throw new Error("Buffer is not a valid image");
  }

  const detectedExt = extFromBuffer(bytes);

  if (!detectedExt) {
    throw new Error("Could not detect image format");
  }

  // Normalize to JPEG
  const convertedBytes = await convertToJpeg(bytes, detectedExt);
  const finalBytes = Buffer.from(new Uint8Array(convertedBytes));

  const id = uuidFromBytes(finalBytes);
  const fileName = `${id}.jpg`;
  const filePath = path.join(options.directory, fileName);

  if (!(await fileExists(filePath))) {
    await fs.writeFile(filePath, finalBytes);
  }

  return `${options.webPrefix}/${fileName}`;
}

// --- Core image delete helper ---

interface DeleteImageOptions {
  /** URL pattern regex with named groups: recipeId, filename */
  urlPattern: RegExp;
  /** Function to build the file path from matched groups */
  buildPath: (recipeId: string, filename: string) => string;
  /** Log label for this image type */
  label: string;
}

/**
 * Core helper to delete an image by URL.
 * All image delete functions should use this internally.
 */
async function deleteImageByUrlCore(url: string, options: DeleteImageOptions): Promise<void> {
  const match = url.match(options.urlPattern);

  if (!match) {
    throw new Error(`Invalid ${options.label} image URL format`);
  }

  const [, recipeId, filename] = match;

  // Validate recipeId is a UUID
  if (!/^[a-f0-9-]{36}$/i.test(recipeId)) {
    throw new Error("Invalid recipe ID in URL");
  }

  // Validate filename
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename)) {
    throw new Error("Invalid filename in URL");
  }

  const filePath = options.buildPath(recipeId, filename);

  try {
    await fs.unlink(filePath);
    log.info({ recipeId, filename }, `Deleted ${options.label} image`);
  } catch (err) {
    log.warn({ err, recipeId, filename }, `Could not delete ${options.label} image`);
    throw err;
  }
}

// --- Main functions ---

/**
 * Download an image from URL and save to recipe directory.
 * Path: uploads/recipes/{recipeId}/{hash}.jpg
 * URL: /recipes/{recipeId}/{hash}.jpg
 */
export async function downloadImage(url: string, recipeId: string): Promise<string> {
  const recipeDir = path.join(RECIPES_BASE_DIR, recipeId);

  await ensureDir(recipeDir);

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const res = await fetchWithTimeout(url);

  if (!res.ok || !res.body) {
    throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
  }

  // Check content type
  const contentType = res.headers.get("content-type") || undefined;

  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(`URL does not return an image (content-type: ${contentType})`);
  }

  // Check content length if available
  const contentLength = res.headers.get("content-length");

  if (contentLength && parseInt(contentLength) > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
    throw new Error(
      `Image too large: ${contentLength} bytes (max: ${SERVER_CONFIG.MAX_IMAGE_FILE_SIZE})`
    );
  }

  const arrayBuffer = await res.arrayBuffer();

  // Check actual size
  if (arrayBuffer.byteLength > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
    throw new Error(
      `Image too large: ${arrayBuffer.byteLength} bytes (max: ${SERVER_CONFIG.MAX_IMAGE_FILE_SIZE})`
    );
  }

  let bytes = Buffer.from(new Uint8Array(arrayBuffer));

  const ext = deriveExtFromBytes(url, contentType, bytes);

  // Validate it's actually an image
  if (!isValidImageBuffer(bytes)) {
    throw new Error("Downloaded file is not a valid image");
  }

  // Normalize everything to JPEG
  if ([".heic", ".avif", ".png", ".webp", ".jpg", ".jpeg"].includes(ext)) {
    const convertedBytes = await convertToJpeg(bytes, ext);

    bytes = Buffer.from(new Uint8Array(convertedBytes));
  }

  const id = uuidFromBytes(bytes);
  const fileName = `${id}.jpg`;
  const filePath = path.join(recipeDir, fileName);

  if (!(await fileExists(filePath))) {
    await fs.writeFile(filePath, bytes);
  }

  return `/recipes/${recipeId}/${fileName}`;
}

/**
 * Download best image from JSON-LD field.
 * Path: uploads/recipes/{recipeId}/{hash}.jpg
 */
export async function downloadBestImageFromJsonLd(
  imageField: any,
  recipeId: string
): Promise<string | undefined> {
  const candidates = normalizeJsonLdImages(imageField);

  if (!candidates.length) {
    return undefined;
  }

  // Sort by area (largest first), with unknown sizes at the end
  const ordered = (() => {
    const withArea = candidates
      .map((c) => ({ c, a: area(c) }))
      .filter((x): x is { c: ImageCandidate; a: number } => typeof x.a === "number")
      .sort((x, y) => y.a - x.a)
      .map((x) => x.c);

    const withoutArea = candidates.filter((c) => !area(c));

    return [...withArea, ...withoutArea];
  })();

  // Try each candidate in order
  for (let i = 0; i < ordered.length; i++) {
    const cand = ordered[i];

    try {
      return await downloadImage(cand.url, recipeId);
    } catch (_e) {
      // Fail silently and try next
    }
  }

  return undefined;
}

/**
 * Save image bytes to recipe directory.
 * Path: uploads/recipes/{recipeId}/{hash}.jpg
 * URL: /recipes/{recipeId}/{hash}.jpg
 */
export async function saveImageBytes(bytes: Buffer, recipeId: string): Promise<string> {
  return saveImageBytesCore(bytes, {
    directory: path.join(RECIPES_BASE_DIR, recipeId),
    webPrefix: `/recipes/${recipeId}`,
  });
}

/**
 * Save step image bytes to recipe steps directory.
 * Path: uploads/recipes/{recipeId}/steps/{hash}.jpg
 * URL: /recipes/{recipeId}/steps/{hash}.jpg
 */
export async function saveStepImageBytes(bytes: Buffer, recipeId: string): Promise<string> {
  return saveImageBytesCore(bytes, {
    directory: path.join(RECIPES_BASE_DIR, recipeId, "steps"),
    webPrefix: `/recipes/${recipeId}/steps`,
  });
}

/**
 * Delete recipe image by URL.
 * URL format: /recipes/{recipeId}/{hash}.jpg
 */
export async function deleteImageByUrl(url: string): Promise<void> {
  return deleteImageByUrlCore(url, {
    urlPattern: /^\/recipes\/([a-f0-9-]+)\/([^/]+)$/i,
    buildPath: (recipeId, filename) => path.join(RECIPES_BASE_DIR, recipeId, filename),
    label: "recipe",
  });
}

/**
 * Delete step image by URL.
 * URL format: /recipes/{recipeId}/steps/{hash}.jpg
 */
export async function deleteStepImageByUrl(url: string): Promise<void> {
  return deleteImageByUrlCore(url, {
    urlPattern: /^\/recipes\/([a-f0-9-]+)\/steps\/([^/]+)$/i,
    buildPath: (recipeId, filename) => path.join(RECIPES_BASE_DIR, recipeId, "steps", filename),
    label: "step",
  });
}

/**
 * Delete entire recipe directory (all images including steps).
 */
export async function deleteRecipeImagesDir(recipeId: string): Promise<void> {
  const recipeDir = path.join(RECIPES_BASE_DIR, recipeId);

  try {
    const exists = await fs
      .access(recipeDir)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      log.debug({ recipeId, recipeDir }, "Recipe images directory does not exist, skipping");

      return;
    }

    await fs.rm(recipeDir, { recursive: true, force: true });
    log.info({ recipeId, recipeDir }, "Deleted recipe images directory");
  } catch (err) {
    log.warn({ err, recipeId, recipeDir }, "Could not delete recipe images directory");
  }
}

/**
 * Delete step images directory only.
 */
export async function deleteRecipeStepImagesDir(recipeId: string): Promise<void> {
  const stepImagesDir = path.join(RECIPES_BASE_DIR, recipeId, "steps");

  try {
    await fs.rm(stepImagesDir, { recursive: true, force: true });
    log.info({ recipeId }, "Deleted step images directory");
  } catch (err) {
    // Ignore errors (directory might not exist)
    log.warn({ err, recipeId }, "Could not delete step images directory");
  }
}

/**
 * Download all images from JSON-LD image field, up to maxImages count.
 * Returns array of web URLs for successfully downloaded images.
 * Prioritizes larger images first based on dimensions metadata.
 * Path: uploads/recipes/{recipeId}/{hash}.jpg
 */
export async function downloadAllImagesFromJsonLd(
  imageField: any,
  recipeId: string,
  maxImages: number = 10
): Promise<string[]> {
  const candidates = normalizeJsonLdImages(imageField);

  if (!candidates.length) {
    return [];
  }

  // Sort by area (largest first), with unknown sizes at the end
  const ordered = (() => {
    const withArea = candidates
      .map((c) => ({ c, a: area(c) }))
      .filter((x): x is { c: ImageCandidate; a: number } => typeof x.a === "number")
      .sort((x, y) => y.a - x.a)
      .map((x) => x.c);

    const withoutArea = candidates.filter((c) => !area(c));

    return [...withArea, ...withoutArea];
  })();

  const downloadedUrls: string[] = [];

  // Try each candidate in order up to maxImages
  for (let i = 0; i < ordered.length && downloadedUrls.length < maxImages; i++) {
    const cand = ordered[i];

    try {
      const webUrl = await downloadImage(cand.url, recipeId);

      downloadedUrls.push(webUrl);
    } catch (_e) {
      // Fail silently and try next
      log.debug({ url: cand.url }, "Failed to download image, trying next");
    }
  }

  return downloadedUrls;
}

// --- Video File Helpers ---

function videoMimeFromExt(ext: string): string {
  const mimes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
  };

  return mimes[ext] || "video/mp4";
}

export interface ConvertToMp4Result {
  /** Path to the MP4 file (may be same as input if already MP4) */
  filePath: string;
  /** Whether conversion was performed */
  converted: boolean;
  /** Method used: 'none', 'remux', 'transcode', 'original' */
  method: "none" | "remux" | "transcode" | "original";
}

/**
 * Convert video to MP4 format if needed.
 * Strategy: Try remux first (fast, lossless), fallback to transcode, keep original if both fail.
 */
export async function convertToMp4(
  inputPath: string,
  ffmpegPath: string | null
): Promise<ConvertToMp4Result> {
  const ext = path.extname(inputPath).toLowerCase();

  // Already MP4 - no conversion needed
  if (ext === ".mp4") {
    log.debug({ inputPath }, "Video is already MP4, no conversion needed");

    return { filePath: inputPath, converted: false, method: "none" };
  }

  if (!ffmpegPath) {
    log.warn({ inputPath }, "ffmpeg not available, keeping original format");

    return { filePath: inputPath, converted: false, method: "original" };
  }

  const dir = path.dirname(inputPath);
  const baseName = path.basename(inputPath, ext);
  const outputPath = path.join(dir, `${baseName}.mp4`);

  // Try remux first (fast, lossless copy of streams into MP4 container)
  try {
    log.debug({ inputPath, outputPath }, "Attempting video remux to MP4");

    await runFfmpeg(ffmpegPath, [
      "-i",
      inputPath,
      "-c",
      "copy", // Copy streams without re-encoding
      "-movflags",
      "+faststart", // Optimize for web streaming
      outputPath,
    ]);

    // Verify output exists and has content
    const stats = await fs.stat(outputPath);

    if (stats.size > 0) {
      // Remove original file
      await fs.unlink(inputPath).catch(() => {});
      log.info({ inputPath, outputPath, size: stats.size }, "Video remuxed to MP4 successfully");

      return { filePath: outputPath, converted: true, method: "remux" };
    }
  } catch (remuxErr) {
    log.debug({ err: remuxErr }, "Remux failed, trying transcode");
    // Remove failed output if it exists
    await fs.unlink(outputPath).catch(() => {});
  }

  // Fallback to transcode (slower, but handles incompatible codecs)
  try {
    log.debug({ inputPath, outputPath }, "Attempting video transcode to MP4");

    await runFfmpeg(ffmpegPath, [
      "-i",
      inputPath,
      "-c:v",
      "libx264", // Re-encode video to H.264
      "-preset",
      "fast", // Balance speed vs compression
      "-crf",
      "23", // Quality (lower = better, 23 is good default)
      "-c:a",
      "aac", // Re-encode audio to AAC
      "-b:a",
      "128k", // Audio bitrate
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const stats = await fs.stat(outputPath);

    if (stats.size > 0) {
      await fs.unlink(inputPath).catch(() => {});
      log.info({ inputPath, outputPath, size: stats.size }, "Video transcoded to MP4 successfully");

      return { filePath: outputPath, converted: true, method: "transcode" };
    }
  } catch (transcodeErr) {
    log.warn({ err: transcodeErr }, "Transcode failed, keeping original format");
    await fs.unlink(outputPath).catch(() => {});
  }

  // Keep original if all conversion attempts failed
  log.warn({ inputPath }, "All conversion attempts failed, keeping original format");

  return { filePath: inputPath, converted: false, method: "original" };
}

/**
 * Run ffmpeg command and return a promise.
 */
function runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ["-y", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export interface SavedVideo {
  /** Web URL path to the video */
  video: string;
  /** Video duration in seconds (if known) */
  duration: number | null;
}

/**
 * Save a video file to the recipe directory.
 * Path: uploads/recipes/{recipeId}/video-{timestamp}.mp4
 * URL: /recipes/{recipeId}/video-{timestamp}.mp4
 */
export async function saveVideoFile(
  sourcePath: string,
  recipeId: string,
  duration?: number
): Promise<SavedVideo> {
  const recipeDir = path.join(RECIPES_BASE_DIR, recipeId);

  await ensureDir(recipeDir);

  // Validate file size
  const stats = await fs.stat(sourcePath);
  const maxVideoFileSize = await getMaxVideoFileSize();

  if (stats.size > maxVideoFileSize) {
    throw new Error(`Video file too large: ${stats.size} bytes (max: ${maxVideoFileSize})`);
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const timestamp = Date.now();
  const fileName = `video-${timestamp}${ext}`;
  const destPath = path.join(recipeDir, fileName);

  // Copy file to recipe directory
  await fs.copyFile(sourcePath, destPath);

  log.info({ sourcePath, destPath, size: stats.size }, "Video file saved");

  return {
    video: `/recipes/${recipeId}/${fileName}`,
    duration: duration ?? null,
  };
}

/**
 * Get MIME type for a video file extension.
 */
export function getVideoMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  return videoMimeFromExt(ext);
}

/**
 * Valid video extensions for uploaded videos
 */
const ALLOWED_VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v"]);

/**
 * Detect video extension from buffer magic bytes
 */
function extFromVideoBuffer(buf: Buffer): string | undefined {
  if (buf.length < 12) return undefined;

  // MP4/M4V/MOV (ftyp box)
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    const brand = buf.slice(8, 12).toString("ascii");

    // Common MP4 brands
    if (
      brand === "isom" ||
      brand === "iso2" ||
      brand === "mp41" ||
      brand === "mp42" ||
      brand === "avc1" ||
      brand === "M4V " ||
      brand === "M4VP"
    ) {
      return ".mp4";
    }
    // QuickTime
    if (brand === "qt  " || brand === "moov") {
      return ".mov";
    }

    // Default to mp4 for ftyp containers
    return ".mp4";
  }

  // WebM (EBML header)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return ".webm";
  }

  return undefined;
}

/**
 * Save video bytes to recipe directory.
 * Path: uploads/recipes/{recipeId}/video-{timestamp}.{ext}
 * URL: /recipes/{recipeId}/video-{timestamp}.{ext}
 */
export async function saveVideoBytes(
  bytes: Buffer,
  recipeId: string,
  originalExt?: string,
  duration?: number
): Promise<SavedVideo> {
  const recipeDir = path.join(RECIPES_BASE_DIR, recipeId);

  await ensureDir(recipeDir);

  // Validate buffer size
  const maxVideoFileSize = await getMaxVideoFileSize();

  if (bytes.length > maxVideoFileSize) {
    throw new Error(`Video too large: ${bytes.length} bytes (max: ${maxVideoFileSize})`);
  }

  // Detect extension from magic bytes or use provided
  let ext = extFromVideoBuffer(bytes);

  if (!ext && originalExt) {
    const normalizedExt = originalExt.startsWith(".")
      ? originalExt.toLowerCase()
      : `.${originalExt.toLowerCase()}`;

    if (ALLOWED_VIDEO_EXTS.has(normalizedExt)) {
      ext = normalizedExt;
    }
  }
  if (!ext) {
    ext = ".mp4"; // Default to mp4
  }

  const timestamp = Date.now();
  const fileName = `video-${timestamp}${ext}`;
  const filePath = path.join(recipeDir, fileName);

  await fs.writeFile(filePath, bytes);

  log.info({ recipeId, fileName, size: bytes.length }, "Video bytes saved");

  return {
    video: `/recipes/${recipeId}/${fileName}`,
    duration: duration ?? null,
  };
}

/**
 * Delete recipe video by URL.
 * URL format: /recipes/{recipeId}/video-{timestamp}.{ext}
 */
export async function deleteVideoByUrl(url: string): Promise<void> {
  // Match video URLs: /recipes/{uuid}/video-{timestamp}.{ext}
  const match = url.match(/^\/recipes\/([a-f0-9-]+)\/(video-[^/]+)$/i);

  if (!match) {
    throw new Error("Invalid video URL format");
  }

  const [, recipeId, filename] = match;

  // Validate recipeId is a UUID
  if (!/^[a-f0-9-]{36}$/i.test(recipeId)) {
    throw new Error("Invalid recipe ID in URL");
  }

  // Validate filename pattern
  if (!/^video-\d+\.[a-zA-Z0-9]+$/.test(filename)) {
    throw new Error("Invalid video filename in URL");
  }

  const filePath = path.join(RECIPES_BASE_DIR, recipeId, filename);

  try {
    await fs.unlink(filePath);
    log.info({ recipeId, filename }, "Deleted video file");
  } catch (err) {
    log.warn({ err, recipeId, filename }, "Could not delete video file");
    throw err;
  }
}
