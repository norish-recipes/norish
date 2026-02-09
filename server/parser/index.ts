import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

import { fetchViaPlaywright } from "./fetch";

import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { tryExtractRecipeFromJsonLd, extractRecipeNodesFromJsonLd } from "@/server/parser/jsonld";
import { tryExtractRecipeFromMicrodata } from "@/server/parser/microdata";
import { extractRecipeWithAI } from "@/server/ai/recipe-parser";
import {
  getContentIndicators,
  isAIEnabled,
  isVideoParsingEnabled,
  shouldAlwaysUseAI,
} from "@/config/server-config-loader";
import { isVideoUrl } from "@/server/helpers";
import { parserLogger as log } from "@/server/logger";

export interface ParseRecipeResult {
  recipe: FullRecipeInsertDTO;
  /** Whether AI was used for extraction (affects auto-tagging) */
  usedAI: boolean;
}

/**
 * Checks if a parsed recipe has valid ingredients and steps.
 * Used to determine if structured parsing was successful.
 */
function hasValidRecipeData(recipe: FullRecipeInsertDTO | null): recipe is FullRecipeInsertDTO {
  return (
    !!recipe &&
    Array.isArray(recipe.recipeIngredients) &&
    recipe.recipeIngredients.length > 0 &&
    Array.isArray(recipe.steps) &&
    recipe.steps.length > 0
  );
}

/**
 * Attempt AI extraction. If requireAI = true, throws when AI is disabled.
 */
async function tryExtractWithAI(
  input: string,
  recipeId: string,
  url: string,
  allergies: string[] | undefined,
  requireAI: boolean
): Promise<FullRecipeInsertDTO | null> {
  const enabled = await isAIEnabled();

  if (!enabled) {
    if (requireAI) {
      throw new Error("AI-only import requested but AI is not enabled.");
    }

    return null;
  }

  log.info({ url }, "Attempting AI extraction");
  const result = await extractRecipeWithAI(input, recipeId, url, allergies);

  if (result.success) return result.data;

  log.warn({ url, error: result.error, code: result.code }, "AI extraction failed");

  return null;
}

/**
 * Try AI extraction with smallest/cleanest input first (JSON-LD),
 * then fall back to full HTML.
 */
async function extractWithAIPreference(
  html: string,
  recipeId: string,
  url: string,
  allergies: string[] | undefined,
  requireAI: boolean
): Promise<FullRecipeInsertDTO | null> {
  const jsonLdNodes = extractRecipeNodesFromJsonLd(html);

  if (jsonLdNodes.length > 0) {
    log.info({ url }, "AI: using extracted JSON-LD as input (fewer tokens)");
    const jsonLdInput = JSON.stringify(jsonLdNodes, null, 2);

    const fromJsonLd = await tryExtractWithAI(jsonLdInput, recipeId, url, allergies, requireAI);

    if (fromJsonLd) return fromJsonLd;
  }

  log.info({ url }, "AI: using full HTML as input");

  return tryExtractWithAI(html, recipeId, url, allergies, requireAI);
}

/**
 * Attempts structured parsing using JSON-LD and microdata extractors.
 * Returns recipe if either parser produces valid data, null otherwise.
 */
async function tryStructuredParsers(
  url: string,
  html: string,
  recipeId: string
): Promise<FullRecipeInsertDTO | null> {
  const jsonLdParsed = await tryExtractRecipeFromJsonLd(url, html, recipeId);

  if (hasValidRecipeData(jsonLdParsed)) return jsonLdParsed;

  const microParsed = await tryExtractRecipeFromMicrodata(url, html, recipeId);

  if (hasValidRecipeData(microParsed)) return microParsed;

  return null;
}

/**
 * Handles video URL parsing (YouTube, Instagram, TikTok, etc.).
 * Returns ParseRecipeResult if URL is a video, null if not a video URL.
 * Throws if video parsing is disabled or processing fails.
 */
async function tryHandleVideoUrl(
  url: string,
  recipeId: string,
  allergies?: string[],
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<ParseRecipeResult | null> {
  if (!isVideoUrl(url)) return null;

  if (!(await isVideoParsingEnabled())) {
    throw new Error("Video recipe parsing is not enabled.");
  }

  try {
    const { processVideoRecipe } = await import("@/server/video/processor");
    const recipe = await processVideoRecipe(url, recipeId, allergies, tokens);

    return { recipe, usedAI: true };
  } catch (error: unknown) {
    log.error({ err: error }, "Video processing failed");
    throw error;
  }
}

export async function parseRecipeFromUrl(
  url: string,
  recipeId: string,
  allergies?: string[],
  forceAI?: boolean,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<ParseRecipeResult> {
  const videoResult = await tryHandleVideoUrl(url, recipeId, allergies, tokens);

  if (videoResult) return videoResult;

  const html = await fetchViaPlaywright(url, tokens);

  if (!html) throw new Error("Cannot fetch recipe page.");

  if (!(await isPageLikelyRecipe(html))) {
    throw new Error("Page does not appear to contain a recipe.");
  }

  const useAIOnly = forceAI ?? (await shouldAlwaysUseAI());

  if (useAIOnly) {
    const recipe = await extractWithAIPreference(html, recipeId, url, allergies, true);

    if (!recipe) throw new Error("AI extraction failed");

    return { recipe, usedAI: true };
  }

  const structured = await tryStructuredParsers(url, html, recipeId);

  if (structured) return { recipe: structured, usedAI: false };

  const recipe = await extractWithAIPreference(html, recipeId, url, allergies, false);

  if (recipe) return { recipe, usedAI: true };

  log.error({ url }, "All extraction methods failed");
  throw new Error("Cannot parse recipe.");
}

export async function isPageLikelyRecipe(html: string): Promise<boolean> {
  const lowered = html.toLowerCase();
  const indicators = await getContentIndicators();

  const hasSchema = indicators.schemaIndicators.some((i) => lowered.includes(i.toLowerCase()));
  const contentHits = indicators.contentIndicators.filter((i) =>
    lowered.includes(i.toLowerCase())
  ).length;

  return hasSchema || contentHits >= 2;
}
