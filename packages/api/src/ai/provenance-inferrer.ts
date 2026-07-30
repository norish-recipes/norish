/**
 * Recipe Provenance inference.
 *
 * One AI request produces the whole claim: an origin country, an optional
 * region, the recipe's Cuisines, and a note written in the language the recipe
 * itself is written in. There is no separate language-detection step and no
 * per-locale fan-out — the prompt reads the recipe's language off the recipe
 * text it already has.
 *
 * Proposed Cuisine names are resolved against the administrator's vocabulary
 * here, so what reaches the worker is already vocabulary row ids. Resolution is
 * a pure function; only the vocabulary read and the `extend` row creation touch
 * the database, and both go through the cuisines repository.
 *
 * Inference reads only the stored recipe. It never sees parser output, import
 * metadata, or how the recipe entered Norish.
 */

import { generateText, Output } from "ai";

import type { AIResult } from "@norish/shared-server/ai/types/result";
import type { CuisineVocabularyEntry } from "@norish/shared/lib/cuisine-resolver";
import { createCuisines, listCuisines } from "@norish/db/repositories/cuisines";
import { fillPrompt, loadPrompt } from "@norish/shared-server/ai/prompts/loader";
import { getGenerationSettings, getModels } from "@norish/shared-server/ai/providers";
import {
  aiError,
  aiSuccess,
  getErrorMessage,
  mapErrorToCode,
} from "@norish/shared-server/ai/types/result";
import { getCuisineStrategy, isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";
import { resolveCuisines } from "@norish/shared/lib/cuisine-resolver";

import { buildProvenanceSchema } from "./schemas/provenance.schema";

export interface RecipeForProvenance {
  title: string;
  description: string | null;
  ingredients: string[];
}

/** The stored claim: scalars plus resolved vocabulary row ids, never names. */
export interface ProvenanceInference {
  originCountry: string | null;
  originRegion: string | null;
  provenanceNote: string;
  cuisineIds: string[];
}

async function buildProvenancePrompt(
  recipe: RecipeForProvenance,
  vocabulary: readonly CuisineVocabularyEntry[]
): Promise<string> {
  const template = await loadPrompt("recipe-provenance");

  return fillPrompt(template, {
    recipeName: recipe.title,
    description: recipe.description ? `Description: ${recipe.description}\n` : "",
    ingredients: recipe.ingredients.map((ingredient) => `- ${ingredient}`).join("\n"),
    cuisines:
      vocabulary.length > 0
        ? vocabulary.map((cuisine) => cuisine.name).join(", ")
        : "(no Cuisines are configured; return an empty list)",
  });
}

/**
 * Turn proposed names into vocabulary row ids.
 *
 * Matching runs under both strategies; only the `extend` strategy may add rows.
 * Dropped names are deliberately discarded here: nothing logs, persists, or
 * surfaces them.
 */
async function resolveProposedCuisines(
  proposed: readonly string[],
  vocabulary: readonly CuisineVocabularyEntry[]
): Promise<string[]> {
  const strategy = await getCuisineStrategy();
  const { resolved, created } = resolveCuisines({ proposed, strategy, vocabulary });
  const ids = resolved.map((cuisine) => cuisine.id);

  if (created.length === 0) return ids;

  const rows = await createCuisines(created);
  const byName = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));

  for (const name of created) {
    const id = byName.get(name.toLowerCase());

    if (id) ids.push(id);
  }

  return ids;
}

export async function inferRecipeProvenance(
  recipe: RecipeForProvenance
): Promise<AIResult<ProvenanceInference>> {
  if (!(await isAIEnabled())) {
    aiLogger.info("AI features are disabled, skipping Recipe Provenance inference");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  if (recipe.ingredients.length === 0) {
    aiLogger.warn("No ingredients provided for Recipe Provenance inference");

    return aiError("No ingredients provided", "INVALID_INPUT");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length },
    "Starting Recipe Provenance inference"
  );

  try {
    // The request schema is built from the vocabulary as it stands right now,
    // never from a compile-time list.
    const vocabulary = await listCuisines();
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();
    const prompt = await buildProvenancePrompt(recipe, vocabulary);

    aiLogger.debug({ provider: providerName, prompt }, "Sending provenance prompt to AI");

    const result = await generateText({
      model,
      output: Output.object({
        schema: buildProvenanceSchema(vocabulary.map((cuisine) => cuisine.name)),
      }),
      prompt,
      // Deliberately no language instruction here: the prompt decides the note's
      // language from the recipe, and a system message naming one would win.
      system:
        "You are a culinary historian who places dishes in their country and region of origin.",
      ...settings,
    });

    const output = result.output;

    if (!output) {
      aiLogger.error({ title: recipe.title }, "AI returned empty output for Recipe Provenance");

      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    if (typeof output.provenanceNote !== "string" || output.provenanceNote.trim() === "") {
      // Nothing is written until the request succeeds, so an unusable response
      // fails here rather than storing half a claim.
      aiLogger.error({ title: recipe.title, output }, "Invalid Recipe Provenance response");

      return aiError("AI response is missing the provenance note", "VALIDATION_ERROR");
    }

    const cuisineIds = await resolveProposedCuisines(
      Array.isArray(output.cuisines) ? output.cuisines : [],
      vocabulary
    );

    aiLogger.info(
      {
        title: recipe.title,
        originCountry: output.originCountry,
        originRegion: output.originRegion,
        cuisineCount: cuisineIds.length,
      },
      "Recipe Provenance inference completed"
    );

    return aiSuccess(
      {
        originCountry: output.originCountry,
        originRegion: output.originRegion,
        provenanceNote: output.provenanceNote,
        cuisineIds,
      },
      {
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      }
    );
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, title: recipe.title, code }, "Failed to infer Recipe Provenance");

    return aiError(message, code);
  }
}
