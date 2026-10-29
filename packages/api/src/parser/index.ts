import type { PageSummary } from "@norish/api/parser/page-summary";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { extractSanitizedBody } from "@norish/api/parser/extraction-sanitizer";
import { isBotCheck, plainFetch, renderPage } from "@norish/api/parser/fetch";
import { isParseComplete, isRecipe } from "@norish/api/parser/import-triage";
import { extractRecipeNodesFromJsonLd } from "@norish/api/parser/jsonld";
import { summarisePage } from "@norish/api/parser/page-summary";
import {
  adaptRecipeScrapersResponse,
  collectIngredientStrings,
} from "@norish/api/parser/python/adapter";
import { callRecipeScrapersParser } from "@norish/api/parser/python/client";
import { extractRecipeWithAI } from "@norish/api/parser/recipe-extraction";
import {
  getContentIndicators,
  isAIEnabled,
  isVideoParsingEnabled,
  shouldAlwaysUseAI,
} from "@norish/shared-server/config/server-config-loader";
import { parserLogger as log } from "@norish/shared-server/logger";
import { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import {
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";
import { ErrorWithDetail } from "@norish/shared/lib/error-extensions";
import { hasRecipeName, hasSteps, isVideoUrl } from "@norish/shared/lib/helpers";
import { isIngredientHeading } from "@norish/shared/lib/ingredient-text";

export interface ParseRecipeResult {
  recipe: FullRecipeInsertDTO;
  /** Whether AI was used for extraction (affects auto-tagging) */
  usedAI: boolean;
  /** Import triage scored the structured parse as incomplete, and nothing better came */
  incomplete?: boolean;
  /**
   * Why the Python parser came up empty when AI extraction stood in for it,
   * so a parser that quietly broke still shows on the job's parsing step.
   */
  parserDiagnostics?: ParserDiagnostics;
}

/**
 * What the job monitor shows when the Python parser fails: its reply as the
 * service sent it, a readable summary of the page it was given, and whether
 * AI extraction stood in.
 */
export type ParserDiagnostics = {
  pythonParser: unknown;
  page: PageSummary;
  aiFallback: AIFallback;
};

/** Whether AI extraction stood in for the Python parser, and if not, why not. */
type AIFallback =
  | "used"
  | "disabled"
  | "skipped: the page does not look like a recipe"
  | "skipped: the site refused the request"
  | "tried: extraction found no recipe";

interface StructuredParserFailure {
  code: string;
  message: string;
  /** The body the Python parser sent (or why there was none), for the job step */
  output: unknown;
}

interface StructuredParseOutcome {
  recipe: FullRecipeInsertDTO | null;
  failure: StructuredParserFailure | null;
  /** The scraper's ingredient lines, with the "# " headings JSON-LD has no room for. */
  ingredientLines?: string[];
}

/**
 * An honest identity for the plain fetch: Cloudflare challenges a client that claims a
 * browser its TLS handshake doesn't match, and lets a self-named one through.
 */
const PLAIN_FETCH_USER_AGENT = "Norish";

/** Statuses that mean the site turned the request away rather than failed to serve it. */
const REFUSAL_STATUSES = new Set([401, 403, 429]);

/** The site as a person would name it: `ah.nl` for `https://www.ah.nl/...`. */
function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "The site";
  }
}

/** "ah.nl refused the request (HTTP 403)" for a refusal status, otherwise null. */
function refusalMessage(url: string, status: number | null): string | null {
  return status !== null && REFUSAL_STATUSES.has(status)
    ? `${siteName(url)} refused the request (HTTP ${status})`
    : null;
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
 *
 * The URL parser is the one consumer that wants a non-throwing outcome: it
 * falls back to non-AI parsing when AI extraction fails, so the failure is
 * caught here and answered with null.
 */
async function tryExtractWithAI(
  input: string,
  recipeId: string,
  url: string,
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

  try {
    return await extractRecipeWithAI(input, recipeId, url, originalHtml);
  } catch (error) {
    log.warn({ url, err: error }, "AI extraction failed");

    return null;
  }
}

/**
 * Try AI extraction with smallest/cleanest input first (JSON-LD),
 * then the full HTML, which may hold a method the JSON-LD lacks.
 * `ingredientLines` from the scraper stand in for the JSON-LD's flat list
 * when they hold the recipe's sections.
 */
async function extractWithAIPreference(
  html: string,
  recipeId: string,
  url: string,
  requireAI: boolean,
  ingredientLines: string[] = []
): Promise<FullRecipeInsertDTO | null> {
  const jsonLdNodes = extractRecipeNodesFromJsonLd(html);

  if (jsonLdNodes.length > 0) {
    log.info({ url }, "AI: using extracted JSON-LD as input (fewer tokens)");
    const sectioned = jsonLdNodes.length === 1 && ingredientLines.some(isIngredientHeading);
    const jsonLdInput = JSON.stringify(
      sectioned ? [{ ...jsonLdNodes[0], recipeIngredient: ingredientLines }] : jsonLdNodes,
      null,
      2
    );

    const fromJsonLd = await tryExtractWithAI(jsonLdInput, recipeId, url, requireAI, html);

    if (fromJsonLd && hasSteps(fromJsonLd)) return fromJsonLd;

    if (fromJsonLd) {
      log.info({ url }, "AI: JSON-LD held no steps, trying the full HTML");
      const fromHtml = await tryExtractWithAI(html, recipeId, url, requireAI, html);

      return fromHtml && hasSteps(fromHtml) ? fromHtml : fromJsonLd;
    }
  }

  log.info({ url }, "AI: using full HTML as input");

  return tryExtractWithAI(html, recipeId, url, requireAI, html);
}

async function tryStructuredParser(
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
          output: response.raw,
        },
      };
    }

    const adapted = await adaptRecipeScrapersResponse(response, recipeId, url);

    if (hasRecipeName(adapted)) {
      return {
        recipe: adapted,
        failure: null,
        ingredientLines: collectIngredientStrings(response.recipe),
      };
    }

    return {
      recipe: null,
      failure: {
        code: "InvalidRecipeData",
        message: "Python parser returned recipe data without a valid title",
        output: response.raw,
      },
    };
  } catch (error: unknown) {
    log.error({ err: error, url }, "Python parser request failed");

    return {
      recipe: null,
      failure: {
        code: "ParserServiceRequestFailed",
        message: "Python parser request failed",
        output:
          error instanceof ErrorWithDetail
            ? error.detail
            : { error: error instanceof Error ? error.message : String(error) },
      },
    };
  }
}

/**
 * Handles video URL parsing (YouTube, Instagram, TikTok, etc.).
 * Returns ParseRecipeResult if URL is a video, null if not a video URL.
 * Throws if video parsing is disabled or processing fails.
 */
async function tryHandleVideoUrl(
  url: string,
  recipeId: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<ParseRecipeResult | null> {
  if (!isVideoUrl(url)) return null;

  // Two checks so the failure names the setting that is actually off: a video
  // recipe is extracted with AI, so with AI disabled the import can only cost
  // money (download, transcription) before failing.
  if (!(await isAIEnabled())) {
    throw new Error("Video imports use AI to extract the recipe, and AI features are not enabled.");
  }

  if (!(await isVideoParsingEnabled())) {
    throw new Error("Video recipe parsing is not enabled.");
  }

  const { processVideoRecipe } = await import("@norish/api/video/processor");
  const recipe = await processVideoRecipe(url, recipeId, tokens);

  return { recipe, usedAI: true };
}

/**
 * A plain fetch first: a page whose HTML already holds a JSON-LD recipe needs no browser.
 * Anything else goes to the Page Renderers, and the plain page stands in when none reads it.
 */
async function fetchRecipePage(
  url: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<{ html: string; status: number | null }> {
  const plain = await plainFetch(url, PLAIN_FETCH_USER_AGENT, { tokens });

  if (plain.refused) throw new Error(PRIVATE_ADDRESS_REASON);

  if (plain.status === 200 && extractRecipeNodesFromJsonLd(plain.html).length > 0) {
    log.info({ url }, "Plain fetch found a recipe, skipping the browser");

    return { html: plain.html, status: plain.status };
  }

  const rendered = await renderPage(url, tokens);
  // The solver reports no status, so the plain fetch's refusal stays readable.
  const status = rendered.status ?? plain.status;

  if (rendered.html) return { html: rendered.html, status };
  if (isBotCheck(plain.html)) return { html: "", status };

  return { html: plain.html, status: plain.status };
}

export async function parseRecipeFromUrl(
  url: string,
  recipeId: string,
  forceAI?: boolean,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<ParseRecipeResult> {
  const videoResult = await tryHandleVideoUrl(url, recipeId, tokens);

  if (videoResult) return videoResult;

  const { html, status } = await fetchRecipePage(url, tokens);

  if (!html) throw new Error(refusalMessage(url, status) ?? "Cannot fetch recipe page.");

  const useAIOnly = Boolean(forceAI || (await shouldAlwaysUseAI()));

  if (useAIOnly) {
    const recipe = await extractWithAIPreference(html, recipeId, url, true);

    if (!recipe) throw new Error("AI extraction failed");

    return { recipe, usedAI: true };
  }

  const structured = await tryStructuredParser(url, html, recipeId);
  const aiEnabled = await isAIEnabled();

  if (structured.recipe) {
    // Import triage, question 3: an incomplete parse goes through AI extraction, and stays
    // flagged when it is kept or replaced by a recipe without steps.
    const incomplete = (await isParseComplete(structured.recipe)) === false;

    if (incomplete && aiEnabled) {
      log.info({ url }, "Structured parse judged incomplete, attempting AI extraction");

      const recipe = await extractWithAIPreference(
        html,
        recipeId,
        url,
        false,
        structured.ingredientLines
      );

      if (recipe) return { recipe, usedAI: true, ...(hasSteps(recipe) ? {} : { incomplete }) };
    }

    return { recipe: structured.recipe, usedAI: false, ...(incomplete ? { incomplete } : {}) };
  }

  // A site that turned the request away served a page with nothing to read,
  // and saying so beats blaming the parser for it. Only when the parser also
  // came up empty: a bot check that answers 403 and then hands over the real
  // page parses fine and never gets here.
  const refusal = structured.failure ? refusalMessage(url, status) : null;

  if (structured.failure && refusal) {
    log.warn({ url, status, failureCode: structured.failure.code }, "Site refused the request");
    throw new ErrorWithDetail(
      refusal,
      diagnose(structured.failure, html, "skipped: the site refused the request")
    );
  }

  // Import triage, question 1, asked once: a clear "no" names why the import
  // failed, and anything else proceeds to the AI fallback's own gate.
  const pageIsRecipe = await isRecipe(extractSanitizedBody(html));
  // Why AI extraction did or did not stand in, so the job monitor answers
  // "did it even try?" beside the parser's reply.
  let aiFallback: AIFallback = "disabled";

  if (aiEnabled) {
    aiFallback = "skipped: the page does not look like a recipe";

    if (pageIsRecipe ?? (await isPageLikelyRecipe(html))) {
      log.info(
        {
          url,
          failureCode: structured.failure?.code,
        },
        "Structured parsing failed, attempting AI fallback"
      );

      const recipe = await extractWithAIPreference(html, recipeId, url, false);

      if (recipe) {
        return {
          recipe,
          usedAI: true,
          ...(structured.failure
            ? { parserDiagnostics: diagnose(structured.failure, html, "used") }
            : {}),
        };
      }

      aiFallback = "tried: extraction found no recipe";
    }
  }

  if (structured.failure) {
    log.error({ url, failureCode: structured.failure.code }, "Structured parsing failed");
    throw new ErrorWithDetail(
      pageIsRecipe === false ? NOT_A_RECIPE_REASON : structured.failure.message,
      diagnose(structured.failure, html, aiFallback)
    );
  }

  log.error({ url }, "All extraction methods failed");
  throw new Error("Cannot parse recipe.");
}

function diagnose(
  failure: StructuredParserFailure,
  html: string,
  aiFallback: AIFallback
): ParserDiagnostics {
  return { pythonParser: failure.output, page: summarisePage(html), aiFallback };
}

/**
 * The content-indicator rule: whether a page the structured parser found
 * nothing on is worth an AI extraction when the Decision Model has no
 * opinion. The keyword list keeps its meaning and its admin editor.
 */
export async function isPageLikelyRecipe(html: string): Promise<boolean> {
  const lowered = html.toLowerCase();
  const indicators = await getContentIndicators();

  const hasSchema = indicators.schemaIndicators.some((i) => lowered.includes(i.toLowerCase()));
  const contentHits = indicators.contentIndicators.filter((i) =>
    lowered.includes(i.toLowerCase())
  ).length;

  return hasSchema || contentHits >= 2;
}
