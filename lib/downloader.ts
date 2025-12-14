import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

import { v5 as uuidv5 } from "uuid";
import sharp from "sharp";
import convert from "heic-convert";

import { SERVER_CONFIG } from "@/config/env-config-server";
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

const RECIPES_DISK_DIR = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes");
const RECIPES_WEB_PREFIX = "/recipes/images";

// Configuration constants
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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

// --- Main functions ---

export async function downloadImage(url: string): Promise<string> {
  await ensureDir(RECIPES_DISK_DIR);

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

  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    throw new Error(`Image too large: ${contentLength} bytes (max: ${MAX_FILE_SIZE})`);
  }

  const arrayBuffer = await res.arrayBuffer();

  // Check actual size
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(`Image too large: ${arrayBuffer.byteLength} bytes (max: ${MAX_FILE_SIZE})`);
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
  const filePath = path.join(RECIPES_DISK_DIR, fileName);

  if (!(await fileExists(filePath))) {
    await fs.writeFile(filePath, bytes);
  }

  return `${RECIPES_WEB_PREFIX}/${fileName}`;
}

export async function downloadBestImageFromJsonLd(imageField: any): Promise<string | undefined> {
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
      return await downloadImage(cand.url);
    } catch (_e) {
      // Fail silently and try next
    }
  }

  return undefined;
}

export async function saveImageBytes(bytes: Buffer, _nameHint?: string): Promise<string> {
  await ensureDir(RECIPES_DISK_DIR);

  // Validate buffer size
  if (bytes.length > MAX_FILE_SIZE) {
    throw new Error(`Image too large: ${bytes.length} bytes (max: ${MAX_FILE_SIZE})`);
  }

  // Validate it's an image
  if (!isValidImageBuffer(bytes)) {
    throw new Error("Buffer is not a valid image");
  }

  const detectedExt = extFromBuffer(bytes);
  let finalBytes = bytes;
  const finalExt = ".jpg";

  // Normalize any image type to JPEG 720p
  if (detectedExt) {
    const convertedBytes = await convertToJpeg(bytes, detectedExt);

    finalBytes = Buffer.from(new Uint8Array(convertedBytes));
  } else {
    throw new Error("Could not detect image format");
  }

  const id = uuidFromBytes(finalBytes);
  const fileName = `${id}${finalExt}`;
  const filePath = path.join(RECIPES_DISK_DIR, fileName);

  if (!(await fileExists(filePath))) {
    await fs.writeFile(filePath, finalBytes);
  }

  return `${RECIPES_WEB_PREFIX}/${fileName}`;
}

export async function saveStepImageBytes(bytes: Buffer, recipeId: string): Promise<string> {
  const stepImagesDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", recipeId, "steps");
  await ensureDir(stepImagesDir);

  // Validate buffer size
  if (bytes.length > MAX_FILE_SIZE) {
    throw new Error(`Image too large: ${bytes.length} bytes (max: ${MAX_FILE_SIZE})`);
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
  const filePath = path.join(stepImagesDir, fileName);

  if (!(await fileExists(filePath))) {
    await fs.writeFile(filePath, finalBytes);
  }

  return `/recipes/${recipeId}/steps/${fileName}`;
}

export async function deleteRecipeStepImagesDir(recipeId: string): Promise<void> {
  const stepImagesDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", recipeId, "steps");

  try {
    await fs.rm(stepImagesDir, { recursive: true, force: true });
    log.info({ recipeId }, "Deleted step images directory");
  } catch (err) {
    // Ignore errors (directory might not exist)
    log.warn({ err, recipeId }, "Could not delete step images directory");
  }
}

export async function deleteStepImageByUrl(url: string): Promise<void> {
  // URL format: /recipes/<recipeId>/steps/<filename>
  const match = url.match(/^\/recipes\/([a-f0-9-]+)\/steps\/([^/]+)$/i);

  if (!match) {
    throw new Error("Invalid step image URL format");
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

  const filePath = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", recipeId, "steps", filename);

  try {
    await fs.unlink(filePath);
    log.info({ recipeId, filename }, "Deleted step image");
  } catch (err) {
    log.warn({ err, recipeId, filename }, "Could not delete step image");
    throw err;
  }
}
