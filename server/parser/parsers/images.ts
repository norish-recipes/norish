/**
 * Image handling for JSON-LD recipe normalization.
 *
 * Handles downloading and normalizing images from JSON-LD image fields.
 */

import * as cheerio from "cheerio";

import { downloadAllImagesFromJsonLd } from "@/server/downloader";
import { MAX_RECIPE_IMAGES } from "@/server/db/zodSchemas";

export interface ParsedImage {
  image: string;
  order: number;
}

export interface ImageParseResult {
  images: ParsedImage[];
  primaryImage: string | undefined;
}

/**
 * Check if an image path is a local web path (already downloaded).
 */
function isLocalPath(img: unknown): img is string {
  return typeof img === "string" && img.startsWith("/recipes/");
}

/**
 * Extract image candidates from HTML content.
 * Prioritizes og:image and images within main content area.
 * Handles lazy loading attributes (data-src, etc.).
 *
 * @param html - HTML content to scan
 * @param baseUrl - Optional base URL to resolve relative paths
 * @returns Array of absolute image URLs
 */
export function extractImageCandidates(html: string, baseUrl?: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:url"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");

  const candidates: {
    src: string;
    score: number;
  }[] = [];

  const resolveUrl = (url: string) => {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return null;
    }
  };

  if (ogImage) {
    const resolved = resolveUrl(ogImage);

    if (resolved) {
      candidates.push({ src: resolved, score: 100_000 });
    }
  }

  const $body = $("body");

  // Prefer main/article if present to avoid header/footer images
  const $root = $body.find("main").first().length
    ? $body.find("main").first()
    : $body.find("article").first().length
      ? $body.find("article").first()
      : $body;

  // Common recipe containers to further prioritize
  const $recipe = $body.find('[class*="recipe"], [id*="recipe"]').first();
  const $target = $recipe.length ? $recipe : $root;

  $target.find("img").each((i, el) => {
    const src = $(el).attr("src");
    const dataSrc =
      $(el).attr("data-src") ||
      $(el).attr("data-lazy-src") ||
      $(el).attr("data-pin-media") ||
      $(el).attr("data-original");

    let urlToUse = src;

    // If src is a data URI, placeholder, or missing, prefer data-src
    if (
      !urlToUse ||
      urlToUse.startsWith("data:") ||
      urlToUse.includes("placeholder") ||
      urlToUse.includes("transparent")
    ) {
      urlToUse = dataSrc || urlToUse;
    }

    if (!urlToUse || urlToUse.startsWith("data:")) return;

    const resolved = resolveUrl(urlToUse);

    if (!resolved) return;

    if (resolved.endsWith(".svg")) return;

    const alt = ($(el).attr("alt") || "").toLowerCase();

    const width = Number($(el).attr("width")) || 0;
    const height = Number($(el).attr("height")) || 0;
    const area = width * height;

    let score = area > 0 ? area : 5_000;

    if (alt.length > 10) score += 5_000;
    // Prioritize images earlier in the content, but not so much they override large images
    score += Math.max(0, 10_000 - i * 500);

    if (alt.includes("logo")) score -= 100_000;
    if (alt.includes("icon")) score -= 100_000;
    if (alt.includes("social")) score -= 100_000;
    if (alt.includes("avatar")) score -= 100_000;
    if (alt.includes("banner")) score -= 50_000;

    candidates.push({ src: resolved, score });
  });

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();

  for (const cand of candidates) {
    if (!seen.has(cand.src)) {
      urls.add(cand.src);
      seen.add(cand.src);
    }
    if (urls.size >= MAX_RECIPE_IMAGES) break;
  }

  return [...urls];
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
