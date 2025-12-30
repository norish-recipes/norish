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
  log.debug({ htmlLength: html.length }, "Attempting to extract caption from HTML");

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
    log.debug(
      { source: "meta", decodedLength: decoded.length, preview: decoded.substring(0, 100) },
      "Found caption in meta tag"
    );
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
    log.debug(
      { source: "altMeta", decodedLength: decoded.length, preview: decoded.substring(0, 100) },
      "Found caption in alternate meta tag format"
    );
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
    log.debug(
      { source: "article", textLength: textContent.length, preview: textContent.substring(0, 100) },
      "Found content in article tag"
    );
    if (textContent.length > 50) {
      return textContent;
    }
  }

  // Log what we found in the HTML for debugging
  const metaTags = html.match(/<meta[^>]+>/gi) || [];
  log.debug(
    {
      metaTagCount: metaTags.length,
      metaTagSamples: metaTags.slice(0, 5),
    },
    "No caption found, dumping meta tag samples"
  );

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

  log.info(
    {
      url,
      descriptionLength: description.length,
      descriptionPreview: description.substring(0, 200),
      title: metadata.title,
      duration: metadata.duration,
      uploader: metadata.uploader,
    },
    "Processing Instagram image post - initial metadata"
  );

  // If yt-dlp returned empty description, try fetching via Playwright
  if (description.length < 50) {
    log.info(
      { url, currentDescriptionLength: description.length },
      "Description from yt-dlp too short (<50 chars), attempting Playwright scrape"
    );
    try {
      const html = await fetchViaPlaywright(url);
      if (html) {
        log.debug({ url, htmlLength: html.length }, "Playwright returned HTML");
        description = extractInstagramCaption(html);
        log.info(
          {
            url,
            descriptionLength: description.length,
            descriptionPreview: description.substring(0, 200),
          },
          "Extracted caption via Playwright"
        );
      } else {
        log.warn({ url }, "Playwright returned empty/null HTML");
      }
    } catch (err) {
      log.warn({ url, err }, "Failed to fetch Instagram page via Playwright");
    }
  } else {
    log.info({ url }, "Using description from yt-dlp metadata (sufficient length)");
  }

  // Require meaningful description content
  if (!description || description.length < 50) {
    log.warn(
      { url, finalDescriptionLength: description.length },
      "Final description too short, cannot extract recipe"
    );
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
