import type { Page, BrowserContext } from "playwright-core";

import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { tryExtractRecipeFromJsonLd } from "@/server/parser/jsonld";
import { tryExtractRecipeFromMicrodata } from "@/server/parser/microdata";
import { fetchViaPuppeteer, type FetchResult } from "@/server/parser/fetch";
import { extractRecipeWithAI } from "@/server/ai/recipe-parser";
import {
  getContentIndicators,
  isAIEnabled,
  isVideoParsingEnabled,
  shouldAlwaysUseAI,
} from "@/config/server-config-loader";
import { isVideoUrl } from "@/server/helpers";
import { parserLogger as log } from "@/server/logger";
import { type ContentSelectors } from "@/server/parser/providers/base";
import { getProviderForUrl } from "@/server/parser/providers";

export interface ParseRecipeResult {
  recipe: FullRecipeInsertDTO;
  /** Whether AI was used for extraction (affects auto-tagging) */
  usedAI: boolean;
}

export async function parseRecipeFromUrl(
  url: string,
  allergies?: string[],
  forceAI?: boolean,
  _redirectDepth: number = 0
): Promise<ParseRecipeResult> {
  // Protect against infinite redirect loops
  const MAX_REDIRECT_DEPTH = 3;

  if (_redirectDepth > MAX_REDIRECT_DEPTH) {
    throw new Error(
      `Maximum redirect depth (${MAX_REDIRECT_DEPTH}) exceeded. Possible redirect loop detected.`
    );
  }

  // Normalize URL first (remove tracking params, etc.)
  let normalizedUrl = url;
  const provider = getProviderForUrl(url);

  if (provider) {
    log.debug({ url, provider: provider.name }, "Provider matched for URL");

    if (provider.normalizeUrl) {
      const normalized = provider.normalizeUrl(url);

      if (normalized) {
        normalizedUrl = normalized.url;
        log.info(
          { original: url, normalized: normalizedUrl, provider: provider.name },
          "URL normalized by provider"
        );
      }
    }
  } else {
    log.debug({ url }, "No provider matched for URL");
  }

  // Check if URL is a video platform (YouTube, Instagram, TikTok, etc.)
  if (await isVideoUrl(normalizedUrl)) {
    const videoEnabled = await isVideoParsingEnabled();

    if (!videoEnabled) {
      throw new Error("Video recipe parsing is not enabled.");
    }

    try {
      const { processVideoRecipe } = await import("@/server/video/processor");
      const recipe = await processVideoRecipe(normalizedUrl, allergies);

      return { recipe, usedAI: true };
    } catch (error: any) {
      log.error({ err: error }, "Video processing failed");
      throw error;
    }
  }

  // Fetch full HTML and keep page/provider reference for potential later extraction
  const fetchResult = await fetchViaPuppeteer(normalizedUrl);

  // Ensure browser resources are ALWAYS cleaned up, even on errors
  try {
    const html = fetchResult.html;

    if (!html) {
      throw new Error("Cannot fetch recipe page.");
    }

    // Check if provider detects a redirect (e.g., Pinterest bookmark to external site)
    if (fetchResult.page && fetchResult.provider?.detectRedirect) {
      try {
        const redirectResult = await fetchResult.provider.detectRedirect(
          fetchResult.page,
          normalizedUrl
        );

        if (redirectResult) {
          log.info(
            {
              originalUrl: normalizedUrl,
              redirectUrl: redirectResult.redirectUrl,
              redirectDepth: _redirectDepth,
            },
            "Provider detected redirect, re-parsing target URL"
          );

          // Clean up current page before redirecting
          await safeCloseContext(fetchResult.context);

          // Recursively parse the redirect target with depth tracking
          return parseRecipeFromUrl(
            redirectResult.redirectUrl,
            allergies,
            forceAI,
            _redirectDepth + 1
          );
        }
      } catch (error) {
        log.warn(
          { err: error, url: normalizedUrl },
          "Redirect detection failed, continuing with current page"
        );
      }
    }

    const isRecipe = await isPageLikelyRecipe(html);

    if (!isRecipe) {
      throw new Error("Page does not appear to contain a recipe.");
    }

    // Check if AI-only mode is requested or globally enabled
    const useAIOnly = forceAI ?? (await shouldAlwaysUseAI());

    if (useAIOnly) {
      log.info({ url }, "AI-only mode enabled, skipping structured parsers");
      const aiEnabled = await isAIEnabled();

      if (!aiEnabled) {
        throw new Error("AI-only import requested but AI is not enabled.");
      }

      // Get focused content from provider if available
      const focusedHtml = await extractFocusedContent(fetchResult);
      const contentForAI = focusedHtml || html;

      const aiResult = await extractRecipeWithAI(contentForAI, url, allergies);

      if (aiResult.success) {
        return { recipe: aiResult.data, usedAI: true };
      }

      throw new Error(`AI extraction failed: ${aiResult.error}`);
    }

    // Standard parsing flow: ALWAYS try structured parsers first on FULL HTML
    const jsonLdParsed = await tryExtractRecipeFromJsonLd(url, html);
    const containsStepsAndIngredients =
      !!jsonLdParsed &&
      Array.isArray(jsonLdParsed.recipeIngredients) &&
      jsonLdParsed.recipeIngredients.length > 0 &&
      Array.isArray(jsonLdParsed.steps) &&
      jsonLdParsed.steps.length > 0;

    if (containsStepsAndIngredients) {
      return { recipe: jsonLdParsed, usedAI: false };
    }

    const microParsed = await tryExtractRecipeFromMicrodata(url, html);
    const containsMicroStepsAndIngredients =
      !!microParsed &&
      Array.isArray(microParsed.recipeIngredients) &&
      microParsed.recipeIngredients.length > 0 &&
      Array.isArray(microParsed.steps) &&
      microParsed.steps.length > 0;

    if (containsMicroStepsAndIngredients) {
      return { recipe: microParsed, usedAI: false };
    }

    // Only attempt AI extraction if AI is enabled
    const aiEnabled = await isAIEnabled();

    if (aiEnabled) {
      log.info({ url }, "Falling back to AI extraction");

      // Get focused content from provider if available
      const focusedHtml = await extractFocusedContent(fetchResult);
      const contentForAI = focusedHtml || html;

      const aiResult = await extractRecipeWithAI(contentForAI, url, allergies);

      if (aiResult.success) {
        return { recipe: aiResult.data, usedAI: true };
      }

      log.warn(
        { url, error: aiResult.error, code: aiResult.code },
        "AI fallback extraction failed"
      );
    }

    log.error({ url }, "All extraction methods failed");
    throw new Error("Cannot parse recipe.");
  } finally {
    // ALWAYS clean up browser resources, even if an error occurred
    await safeCloseContext(fetchResult.context);
  }
}

/**
 * Safely close a browser context with error handling
 * Prevents cleanup errors from shadowing actual errors
 */
async function safeCloseContext(context: BrowserContext | undefined): Promise<void> {
  if (!context) return;

  try {
    await context.close();
  } catch (error) {
    // Log but don't throw - cleanup errors shouldn't shadow real errors
    log.warn({ err: error }, "Failed to close browser context during cleanup");
  }
}

export async function isPageLikelyRecipe(html: string): Promise<boolean> {
  const lowered = html.toLowerCase();
  const indicators = await getContentIndicators();

  const hasSchema = indicators.schemaIndicators.some((i) => lowered.includes(i.toLowerCase()));

  const hasContentHints =
    indicators.contentIndicators.filter((i) => lowered.includes(i.toLowerCase())).length >= 2;

  return hasSchema || hasContentHints;
}

/**
 * Helper function to extract focused content using provider
 * Only called before AI extraction to reduce token costs
 */
async function extractFocusedContent(fetchResult: FetchResult): Promise<string | null> {
  const { page, provider } = fetchResult;

  if (!page || !provider) {
    log.debug("No page or provider available for focused content extraction");

    return null;
  }

  log.debug({ provider: provider.name }, "Attempting focused content extraction with provider");

  try {
    // Try custom extraction function first
    if (provider.extractContent) {
      const extracted = await provider.extractContent(page);

      if (extracted) {
        log.info(
          { provider: provider.name, contentLength: extracted.length },
          "Provider successfully extracted focused content via custom extraction"
        );

        return extracted;
      } else {
        log.debug({ provider: provider.name }, "Provider custom extraction returned null");
      }
    }

    // Try config-based extraction
    if (provider.getContentSelectors) {
      const extracted = await extractWithSelectors(page, provider.getContentSelectors());

      if (extracted) {
        log.info(
          { provider: provider.name, contentLength: extracted.length },
          "Provider successfully extracted focused content via selectors"
        );

        return extracted;
      } else {
        log.debug({ provider: provider.name }, "Provider selector-based extraction returned null");
      }
    }

    log.debug(
      { provider: provider.name },
      "Provider has no extraction methods, falling back to full page content"
    );
  } catch (error) {
    log.warn(
      { err: error, provider: provider.name },
      "Provider content extraction failed, falling back to full page content"
    );
  }

  return null;
}

/**
 * Generic selector-based extraction
 * Tries selectors in priority order and returns HTML from first match
 */
async function extractWithSelectors(page: Page, config: ContentSelectors): Promise<string | null> {
  const { selectors, timeout = 5000 } = config;

  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();

      await element.waitFor({ timeout });

      // Extract HTML (preserves structure for potential fallback to structured parsing)
      const html = await element.innerHTML();

      log.debug({ selector }, "Extracted focused content using selector");

      return html;
    } catch {
      // Element not found or timeout, try next selector
      continue;
    }
  }

  return null;
}
