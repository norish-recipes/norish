import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { asDecisionState, shadowScore } from "@norish/shared-server/ai/enrichment/verification";
import { AIResponseError } from "@norish/shared-server/ai/runtime/errors";
import { generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import { aiLogger } from "@norish/shared-server/logger";

import type { RecipeExtractionOutput } from "./extraction.schema";
import {
  getExtractionLogContext,
  normalizeExtractionOutput,
  validateExtractionOutput,
} from "./extraction-normalizer";
import { buildRecipeExtractionSections } from "./extraction-prompts";
import { extractSanitizedBody } from "./extraction-sanitizer";
import { recipeExtractionSchema } from "./extraction.schema";
import { extractImageCandidates, extractPageVideos } from "./parsers";
import { AI_SOURCE_LIMIT, recipePageText } from "./recipe-page-text";

// Re-export type for consumers
export type { RecipeExtractionOutput };

/**
 * The faithfulness rubric an extraction is scored on, lowest first. Logged
 * only: whether refusing an import on a low score is ever right waits on the
 * disagreement rate this shadow run collects (ADR-0035).
 */
export const EXTRACTION_FAITHFULNESS_LEVELS = [
  "Unfaithful: invents or omits ingredients or steps the source does not support",
  "Mostly faithful: minor drift in amounts, names or order",
  "Faithful: every ingredient and step follows the source",
] as const;

/** What a model has no use for, and on a popular recipe the bulk of its JSON-LD. */
function withoutReviews(node: Record<string, unknown>): Record<string, unknown> {
  const {
    review: _review,
    reviews: _reviews,
    aggregateRating: _rating,
    comment: _comment,
    ...kept
  } = node;

  return kept;
}

/**
 * JSON-LD's video when it has one, else the model's pick. A pick not on the page's own list is
 * dropped: it would otherwise reach the download as a URL only the model vouches for.
 */
function recipeVideos(
  jsonLdVideo: unknown,
  pick: string | null | undefined,
  pageVideos: string[]
): unknown[] {
  if (jsonLdVideo) return [jsonLdVideo].flat();

  return pick && pageVideos.includes(pick) ? [{ "@type": "VideoObject", contentUrl: pick }] : [];
}

/**
 * Extract a recipe using AI, in one request holding everything the source has.
 *
 * @param source - The HTML or text to extract the recipe from.
 * @param url - Optional source URL of the recipe.
 * @param jsonLd - The page's JSON-LD Recipe nodes, which lead over its text.
 * @returns The extracted recipe; throws on AI failure or when the page holds no recipe.
 */
export async function extractRecipeWithAI(
  source: string,
  recipeId: string,
  url?: string,
  jsonLd: Record<string, unknown>[] = []
): Promise<FullRecipeInsertDTO> {
  aiLogger.info({ url }, "Starting AI recipe extraction");

  const [onlyRecipe] = jsonLd.length === 1 ? jsonLd : [];
  const pageText = onlyRecipe
    ? recipePageText(source, onlyRecipe)
    : extractSanitizedBody(source).slice(0, AI_SOURCE_LIMIT);
  const jsonLdText =
    jsonLd.length > 0
      ? JSON.stringify(jsonLd.map(withoutReviews), null, 2).slice(0, AI_SOURCE_LIMIT)
      : undefined;
  const pageVideos = url && !onlyRecipe?.video ? extractPageVideos(source, url) : [];
  const sourceText = jsonLdText ? `${jsonLdText}\n\n${pageText}` : pageText;

  const extracted = await generateStructured({
    prompt: "recipe-extraction",
    schema: recipeExtractionSchema,
    sections: buildRecipeExtractionSections(pageText, {
      url,
      jsonLd: jsonLdText,
      videos: pageVideos,
    }),
  });

  // A page that holds no recipe is a domain outcome the schema cannot state:
  // the model may answer with an empty shell, and storing one would be worse
  // than failing.
  const validation = validateExtractionOutput(extracted);

  if (!validation.valid) {
    aiLogger.error({ url, ...validation.details }, validation.error);

    throw new AIResponseError(validation.error!);
  }

  aiLogger.debug({ url, ...getExtractionLogContext(extracted, null) }, "AI response received");

  // Enrichment Validation in shadow: the extraction is scored against the
  // source it was read from and the verdict logged; nothing acts on it yet.
  await shadowScore({
    feature: "recipe-extraction",
    state: { source: sourceText, extracted: asDecisionState(extracted) },
    instructions: "How faithful is this extracted recipe to the source text?",
    criteria: EXTRACTION_FAITHFULNESS_LEVELS,
  });

  // Extract image candidates from HTML
  const imageCandidates = extractImageCandidates(source, url);

  // Normalize using shared normalizer
  const normalized = await normalizeExtractionOutput(extracted, {
    url,
    imageCandidates,
    recipeId,
    videos: recipeVideos(onlyRecipe?.video, extracted.videoUrl, pageVideos),
  });

  if (!normalized) {
    aiLogger.error({ url }, "Failed to normalize recipe from JSON-LD");

    throw new AIResponseError("Failed to normalize the extracted recipe data.");
  }

  aiLogger.info(
    { url, ...getExtractionLogContext(extracted, normalized) },
    "AI recipe extraction completed"
  );

  return normalized;
}
