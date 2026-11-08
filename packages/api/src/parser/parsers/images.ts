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

/** Lowercased, punctuation folded to spaces, whitespace collapsed: how a title and an alt compare. */
function normalizeTitleText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Below this, a title is too generic ("Recipe", "Home") to recognise an image by. */
const MIN_TITLE_LENGTH = 8;

const SITE_NAME_SEPARATORS = [" | ", " - ", " – ", " — "];

/** A title without its trailing site name: "Pancakes | Example" is "Pancakes". */
function stripSiteName(title: string): string {
  const cut = Math.max(...SITE_NAME_SEPARATORS.map((separator) => title.lastIndexOf(separator)));

  return cut > 0 ? title.slice(0, cut) : title;
}

/**
 * The names the page gives its recipe: its first heading, and its document and social titles with
 * a trailing " | Site" or " - Site" removed. A site-wide social title shared by every page is
 * harmless here, since no recipe image carries it as its alt text.
 */
function pageRecipeTitles($: cheerio.CheerioAPI): string[] {
  const titles = [
    $("h1").first().text(),
    stripSiteName($("title").first().text()),
    stripSiteName($('meta[property="og:title"]').attr("content") ?? ""),
  ];

  return [
    ...new Set(titles.map(normalizeTitleText).filter((title) => title.length >= MIN_TITLE_LENGTH)),
  ];
}

/** Whether an image's alt text names the recipe, so the image is the dish rather than decoration. */
function altNamesRecipe(alt: string, titles: string[]): boolean {
  const normalized = normalizeTitleText(alt);

  if (normalized.length < MIN_TITLE_LENGTH) return false;

  return titles.some((title) => normalized === title || normalized.includes(title));
}

/**
 * The page's image URLs, best first, at most five. An image whose alt text names the recipe leads:
 * it is the dish, where a page's social image is often a site-wide share card and the largest
 * images can belong to related-recipe cards. The social image comes next, then the rest by score.
 */
export function extractImageCandidates(html: string, pageUrl?: string): string[] {
  const $ = cheerio.load(html);
  const recipeTitles = pageRecipeTitles($);
  const titleMatches = new Set<string>();
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
    const markup = `${className} ${id} ${parentContext}`;
    const context = `${alt} ${markup}`;
    // Only the markup can rule out an image naming the recipe: its alt and its URL slug hold the
    // title's own words, and "Navy Bean Soup" holds "nav".
    const namesRecipe =
      altNamesRecipe($img.attr("alt") || "", recipeTitles) &&
      !containsKeyword(markup, CONTEXT_BLOCKLIST);

    if (!namesRecipe && containsKeyword(context, CONTEXT_BLOCKLIST)) return;

    const width = Number($img.attr("width")) || 0;
    const height = Number($img.attr("height")) || 0;
    const area = width * height;

    for (const rawSource of collectRawSources($img)) {
      const source = normalizeImageUrl(rawSource, pageUrl);

      if (!source) continue;

      // One URL per matching image: its srcset variants are the same photo at other sizes.
      if (namesRecipe) {
        titleMatches.add(source);
        break;
      }

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

  // Beside the dish, a social image whose URL marks it as a share card is only another wrong photo.
  const others = [...urls].filter(
    (url) => titleMatches.size === 0 || !containsKeyword(url.toLowerCase(), CONTEXT_BLOCKLIST)
  );

  return [...new Set([...titleMatches, ...others])].slice(0, 5);
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
  };

  if (!imageField) return defaultResult;

  let downloadedImages: string[];

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

  return { images };
}
