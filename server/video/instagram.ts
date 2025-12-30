import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import type { VideoMetadata } from "@/server/video/types";

import { videoLogger as log } from "@/server/logger";
import { downloadImage } from "@/server/downloader";
import { extractRecipeWithAI } from "@/server/ai/recipe-parser";
import { fetchViaPlaywright } from "@/server/parser/fetch";

/**
 * Check if URL is from Instagram.
 */
export function isInstagramUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes("instagram.com");
  } catch {
    return false;
  }
}

/**
 * Check if metadata indicates an image post (no video content).
 * Image posts have duration of 0, null, or undefined.
 */
export function isInstagramImagePost(metadata: VideoMetadata): boolean {
  return !metadata.duration || metadata.duration === 0;
}

/**
 * Extract caption/description from Instagram page HTML.
 * Instagram embeds the caption in meta tags and article content.
 */
function extractInstagramCaption(html: string): string {
  // Try meta description first (often contains the caption)
  const metaMatch = html.match(
    /<meta\s+(?:name|property)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i
  );
  if (metaMatch?.[1]) {
    const decoded = metaMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
    if (decoded.length > 50) {
      return decoded;
    }
  }

  // Try alternate meta tag format (content before name/property)
  const altMetaMatch = html.match(
    /<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["'](?:og:description|description)["']/i
  );
  if (altMetaMatch?.[1]) {
    const decoded = altMetaMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
    if (decoded.length > 50) {
      return decoded;
    }
  }

  // Try to find caption in the page content (Instagram's article structure)
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch?.[1]) {
    // Extract text content, removing HTML tags
    const textContent = articleMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (textContent.length > 50) {
      return textContent;
    }
  }

  return "";
}

/**
 * Process an Instagram image post by extracting recipe from the description/caption.
 * Falls back to AI-based text extraction since there's no audio to transcribe.
 * If yt-dlp returns empty description, attempts to scrape the page via Playwright.
 */
export async function processInstagramImagePost(
  url: string,
  metadata: VideoMetadata,
  allergies?: string[]
): Promise<FullRecipeInsertDTO> {
  let description = metadata.description?.trim() || "";

  log.info({ url }, "Processing Instagram image post");

  // If yt-dlp returned empty description, try fetching via Playwright
  if (description.length < 50) {
    log.info({ url }, "Description from yt-dlp too short, attempting Playwright scrape");
    try {
      const html = await fetchViaPlaywright(url);
      if (html) {
        description = extractInstagramCaption(html);
        log.info(
          { url, descriptionLength: description.length },
          "Extracted caption via Playwright"
        );
      } else {
        log.warn({ url }, "Playwright returned empty/null HTML");
      }
    } catch (err) {
      log.warn({ url, err }, "Failed to fetch Instagram page via Playwright");
    }
  }

  // Require meaningful description content
  if (!description || description.length < 50) {
    throw new Error("Instagram image posts are only supported if the caption contains a recipe");
  }

  // Use existing AI parser - it handles plain text fine
  const result = await extractRecipeWithAI(description, url, allergies);

  if (!result.success) {
    log.warn({ url, error: result.error }, "AI extraction failed for Instagram image post");
    throw new Error("Instagram image posts are only supported if the caption contains a recipe");
  }

  const recipe = result.data;
  if (metadata.thumbnail) {
    try {
      recipe.image = await downloadImage(metadata.thumbnail);
    } catch {
      log.debug({ url }, "Failed to download Instagram thumbnail");
    }
  }

  log.info(
    { url, recipeName: recipe.name },
    "Successfully extracted recipe from Instagram image post"
  );

  return recipe;
}
