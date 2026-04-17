import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { extractRecipeWithAI } from "@norish/api/ai/recipe-parser";
import { isVideoUrl } from "@norish/api/helpers";
import { fetchViaPlaywright } from "@norish/api/parser/fetch";
import { extractRecipeNodesFromJsonLd } from "@norish/api/parser/jsonld";
import { tryLegacyStructuredRecipeParsing } from "@norish/api/parser/legacy";
import { adaptRecipeScrapersResponse } from "@norish/api/parser/python/adapter";
import { callRecipeScrapersParser } from "@norish/api/parser/python/client";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  getContentIndicators,
  isAIEnabled,
  isVideoParsingEnabled,
  shouldAlwaysUseAI,
} from "@norish/config/server-config-loader";
import { parserLogger as log } from "@norish/shared-server/logger";
import { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { hasRecipeName } from "@norish/shared/lib/helpers";

const parserEnvConfig = SERVER_CONFIG as typeof SERVER_CONFIG & {
  LEGACY_RECIPE_PARSER_ROLLBACK: boolean;
};

export interface ParseRecipeResult {
  recipe: FullRecipeInsertDTO;
  /** Whether AI was used for extraction (affects auto-tagging) */
  usedAI: boolean;
}

interface StructuredParserFailure {
  code: string;
  message: string;
}

interface StructuredParseOutcome {
  recipe: FullRecipeInsertDTO | null;
  failure: StructuredParserFailure | null;
}

const NON_RECIPE_FAILURE_CODES = new Set(["NoSchemaFoundInWildMode", "RecipeSchemaNotFound"]);

function getStructuredFailureMessage(code: string): string {
  if (NON_RECIPE_FAILURE_CODES.has(code)) {
    return "Page does not appear to contain a recipe.";
  }

  return `Python parser failed: ${code}`;
}

/**
 * Attempt AI extraction. If requireAI = true, throws when AI is disabled.
 */
async function tryExtractWithAI(
  input: string,
  recipeId: string,
  url: string,
  allergies: string[] | undefined,
  requireAI: boolean,
  originalHtml?: string
): Promise<FullRecipeInsertDTO | null> {
  const enabled = await isAIEnabled();

  if (!enabled) {
    if (requireAI) {
      throw new Error("AI-only import requested but AI is not enabled.");
    }

    return null;
  }

  log.info({ url }, "Attempting AI extraction");
  const result = await extractRecipeWithAI(input, recipeId, url, allergies, originalHtml);

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

    const fromJsonLd = await tryExtractWithAI(
      jsonLdInput,
      recipeId,
      url,
      allergies,
      requireAI,
      html
    );

    if (fromJsonLd) return fromJsonLd;
  }

  log.info({ url }, "AI: using full HTML as input");

  return tryExtractWithAI(html, recipeId, url, allergies, requireAI, html);
}

async function tryPythonStructuredParser(
  url: string,
  html: string,
  recipeId: string
): Promise<StructuredParseOutcome> {
  try {
    const response = await callRecipeScrapersParser({ url, html });

    if (!response.ok) {
      return {
        recipe: null,
        failure: {
          code: response.error,
          message: getStructuredFailureMessage(response.error),
        },
      };
    }

    const adapted = await adaptRecipeScrapersResponse(response, recipeId, url);

    if (hasRecipeName(adapted)) {
      return { recipe: adapted, failure: null };
    }

    return {
      recipe: null,
      failure: {
        code: "InvalidRecipeData",
        message: "Python parser returned recipe data without a valid title",
      },
    };
  } catch (error: unknown) {
    log.error({ err: error, url }, "Python parser request failed");

    return {
      recipe: null,
      failure: {
        code: "ParserServiceRequestFailed",
        message: "Python parser request failed",
      },
    };
  }
}

async function tryStructuredParser(
  url: string,
  html: string,
  recipeId: string
): Promise<StructuredParseOutcome> {
  if (parserEnvConfig.LEGACY_RECIPE_PARSER_ROLLBACK) {
    const legacy = await tryLegacyStructuredRecipeParsing(url, html, recipeId);

    return legacy
      ? { recipe: legacy, failure: null }
      : {
          recipe: null,
          failure: {
            code: "LegacyParserNoRecipe",
            message: "Legacy structured parser did not return a valid recipe",
          },
        };
  }

  return tryPythonStructuredParser(url, html, recipeId);
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
    const { processVideoRecipe } = await import("@norish/api/video/processor");
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

  const useAIOnly = Boolean(forceAI || (await shouldAlwaysUseAI()));

  if (useAIOnly) {
    const recipe = await extractWithAIPreference(html, recipeId, url, allergies, true);

    if (!recipe) throw new Error("AI extraction failed");

    return { recipe, usedAI: true };
  }

  const structured = await tryStructuredParser(url, html, recipeId);

  if (structured.recipe) return { recipe: structured.recipe, usedAI: false };

  const aiEnabled = await isAIEnabled();

  if (aiEnabled && (await isPageLikelyRecipe(html))) {
    log.info(
      {
        url,
        failureCode: structured.failure?.code,
        legacyRollback: parserEnvConfig.LEGACY_RECIPE_PARSER_ROLLBACK,
      },
      "Structured parsing failed, attempting AI fallback"
    );

    const recipe = await extractWithAIPreference(html, recipeId, url, allergies, false);

    if (recipe) return { recipe, usedAI: true };
  }

  if (structured.failure) {
    log.error({ url, failureCode: structured.failure.code }, "Structured parsing failed");
    throw new Error(structured.failure.message);
  }

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
