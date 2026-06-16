/**
 * Image handling for JSON-LD recipe normalization.
 *
 * Handles downloading and normalizing images from JSON-LD image fields.
 */

import * as cheerio from "cheerio";

import { downloadAllImagesFromJsonLd } from "@norish/shared-server/media/storage";
import { MAX_RECIPE_IMAGES } from "@norish/shared/contracts/zod";

export interface ParsedImage {
  image: string;
  order: number;
}

export interface ImageParseResult {
  images: ParsedImage[];
  primaryImage: string | undefined;
}

const IMAGE_ATTRIBUTES = [
  "src",
  "data-src",
  "data-lazy-src",
  "data-original",
  "data-pin-media",
  "data-srcset",
  "srcset",
];

const CONTEXT_BLOCKLIST = [
  "logo",
  "icon",
  "avatar",
  "social",
  "share",
  "sprite",
  "pixel",
  "tracking",
  "advert",
  "banner",
  "header",
  "footer",
  "nav",
  "menu",
  "breadcrumb",
];

const CONTEXT_BOOST = ["recipe", "hero", "featured", "main", "lead"];

function containsKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function normalizeImageUrl(rawUrl: string, pageUrl?: string): string | null {
  const trimmed = rawUrl.trim();

  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return null;
  if (trimmed.endsWith(".svg")) return null;

  try {
    return pageUrl ? new URL(trimmed, pageUrl).toString() : trimmed;
  } catch {
    return null;
  }
}

function parseSrcsetUrls(srcset: string): string[] {
  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(
      (candidate): candidate is string => typeof candidate === "string" && candidate.length > 0
    );
}

function collectRawSources($img: cheerio.Cheerio<any>): string[] {
  const collected: string[] = [];

  for (const attribute of IMAGE_ATTRIBUTES) {
    const value = $img.attr(attribute);

    if (!value) continue;

    if (attribute.endsWith("srcset")) {
      collected.push(...parseSrcsetUrls(value));
      continue;
    }

    collected.push(value);
  }

  return collected;
}

export function extractImageCandidates(html: string, pageUrl?: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  const metaSelectors = [
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  ];

  for (const selector of metaSelectors) {
    const metaUrl = $(selector).attr("content");
    const normalized = metaUrl ? normalizeImageUrl(metaUrl, pageUrl) : null;

    if (normalized) {
      urls.add(normalized);
    }
  }

  const candidates: { src: string; score: number }[] = [];

  $("img").each((index, element) => {
    const $img = $(element);

    if ($img.parents("header, footer, nav").length > 0) return;

    const role = ($img.attr("role") || "").toLowerCase();
    const ariaHidden = ($img.attr("aria-hidden") || "").toLowerCase();

    if (role === "presentation" || ariaHidden === "true") return;

    const alt = ($img.attr("alt") || "").toLowerCase();
    const className = ($img.attr("class") || "").toLowerCase();
    const id = ($img.attr("id") || "").toLowerCase();
    const parentContext = ($img.parents("article, main, figure").attr("class") || "").toLowerCase();
    const context = `${alt} ${className} ${id} ${parentContext}`;

    if (containsKeyword(context, CONTEXT_BLOCKLIST)) return;

    const width = Number($img.attr("width")) || 0;
    const height = Number($img.attr("height")) || 0;
    const area = width * height;

    for (const rawSource of collectRawSources($img)) {
      const source = normalizeImageUrl(rawSource, pageUrl);

      if (!source) continue;

      const srcContext = `${context} ${source.toLowerCase()}`;

      if (containsKeyword(srcContext, CONTEXT_BLOCKLIST)) continue;

      let score = area > 0 ? area : 1_000;

      if (containsKeyword(srcContext, CONTEXT_BOOST)) score += 15_000;
      if ($img.parents("article, main, figure, picture").length > 0) score += 20_000;
      if (alt.length > 10) score += 5_000;
      if (index < 20) score += 1_000;
      if (width > 500 && height > 300) score += 10_000;
      if (width > 0 && height > 0 && (width < 120 || height < 120)) score -= 40_000;

      candidates.push({ src: source, score });
    }
  });

  candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .forEach((candidate) => {
      urls.add(candidate.src);
    });

  return [...urls].slice(0, 5);
}

/**
 * Check if an image path is a local web path (already downloaded).
 */
function isLocalPath(img: unknown): img is string {
  return typeof img === "string" && img.startsWith("/recipes/");
}

/**
 * Parse and download images from JSON-LD image field.
 *
 * This function handles:
 * - Single local paths (already downloaded)
 * - Arrays with mixed local/remote paths
 * - Remote URLs that need downloading
 * - JSON-LD ImageObject structures
 *
 * @param imageField - The image field from JSON-LD (can be string, array, or ImageObject)
 * @param recipeId - Recipe ID for storage paths
 * @returns Parsed images with order and primary image
 */
export async function parseImages(
  imageField: unknown,
  recipeId: string
): Promise<ImageParseResult> {
  const defaultResult: ImageParseResult = {
    images: [],
    primaryImage: undefined,
  };

  if (!imageField) return defaultResult;

  let downloadedImages: string[] = [];

  // Single pre-downloaded image
  if (isLocalPath(imageField)) {
    downloadedImages = [imageField];
  } else if (Array.isArray(imageField)) {
    // Check if all are local paths
    const localPaths = imageField.filter(isLocalPath);
    const remotePaths = imageField.filter((img) => !isLocalPath(img));

    // Use local paths directly, download remote ones
    downloadedImages = [...localPaths];

    if (remotePaths.length > 0) {
      const downloaded = await downloadAllImagesFromJsonLd(
        remotePaths,
        recipeId,
        MAX_RECIPE_IMAGES - localPaths.length
      );

      downloadedImages.push(...downloaded);
    }
  } else {
    // Remote URLs - download them
    downloadedImages = await downloadAllImagesFromJsonLd(imageField, recipeId, MAX_RECIPE_IMAGES);
  }

  // Build images array with order
  const images: ParsedImage[] = downloadedImages.map((img, index) => ({
    image: img,
    order: index,
  }));

  // First image becomes the legacy `image` field for backwards compatibility
  const primaryImage = downloadedImages.length > 0 ? downloadedImages[0] : undefined;

  return { images, primaryImage };
}
