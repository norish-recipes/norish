/**
 * Recipe Provenance inference.
 *
 * One AI request produces the whole claim: an origin country, an optional
 * region, and a note written in the language the recipe itself is written in.
 * There is no separate language-detection step and no per-locale fan-out — the
 * prompt reads the recipe's language off the recipe text it already has.
 *
 * Inference reads only the stored recipe. It never sees parser output, import
 * metadata, or how the recipe entered Norish.
 */

import { generateText, Output } from "ai";

import type { AIResult } from "@norish/shared-server/ai/types/result";
import { fillPrompt, loadPrompt } from "@norish/shared-server/ai/prompts/loader";
import { getGenerationSettings, getModels } from "@norish/shared-server/ai/providers";
import {
  aiError,
  aiSuccess,
  getErrorMessage,
  mapErrorToCode,
} from "@norish/shared-server/ai/types/result";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type { ProvenanceInference } from "./schemas/provenance.schema";
import { buildProvenanceSchema } from "./schemas/provenance.schema";

export type { ProvenanceInference };

export interface RecipeForProvenance {
  title: string;
  description: string | null;
  ingredients: string[];
}

async function buildProvenancePrompt(recipe: RecipeForProvenance): Promise<string> {
  const template = await loadPrompt("recipe-provenance");

  return fillPrompt(template, {
    recipeName: recipe.title,
    description: recipe.description ? `Description: ${recipe.description}\n` : "",
    ingredients: recipe.ingredients.map((ingredient) => `- ${ingredient}`).join("\n"),
  });
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
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();
    const prompt = await buildProvenancePrompt(recipe);

    aiLogger.debug({ provider: providerName, prompt }, "Sending provenance prompt to AI");

    const result = await generateText({
      model,
      output: Output.object({ schema: buildProvenanceSchema() }),
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

    aiLogger.info(
      {
        title: recipe.title,
        originCountry: output.originCountry,
        originRegion: output.originRegion,
      },
      "Recipe Provenance inference completed"
    );

    return aiSuccess(output, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, title: recipe.title, code }, "Failed to infer Recipe Provenance");

    return aiError(message, code);
  }
}
