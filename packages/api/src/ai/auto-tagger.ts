import { generateText, Output } from "ai";

import { getAutoTaggingMode, isAIEnabled } from "@norish/config/server-config-loader";
import { listAllTagNames } from "@norish/db/repositories/tags";
import { getGenerationSettings, getModels } from "@norish/shared-server/ai/providers";
import { aiLogger } from "@norish/shared-server/logger";

import type { AIResult } from "./core/types";
import type { RecipeForTagging } from "./prompts/builder";
import type { AutoTaggingOutput } from "./schemas/auto-tagging.schema";
import { aiError, aiSuccess, getErrorMessage, mapErrorToCode } from "./core/types";
import { buildAutoTaggingPrompt } from "./prompts/builder";
import { autoTaggingSchema } from "./schemas/auto-tagging.schema";

// Re-export types for consumers
export type { AutoTaggingOutput, RecipeForTagging };

/**
 * Generate tags for a recipe using AI.
 *
 * @param recipe - The recipe data to analyze
 * @returns AIResult with array of tag strings, or error
 */
export async function generateTagsForRecipe(recipe: RecipeForTagging): Promise<AIResult<string[]>> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping auto-tagging");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  // Guard: Auto-tagging must be enabled
  const mode = await getAutoTaggingMode();

  if (mode === "disabled") {
    aiLogger.info("Auto-tagging is disabled");

    return aiError("Auto-tagging is disabled", "AI_DISABLED");
  }

  if (recipe.ingredients.length === 0) {
    aiLogger.warn("No ingredients provided for auto-tagging");

    return aiError("No ingredients provided", "INVALID_INPUT");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length, mode },
    "Starting auto-tagging"
  );

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();

    // For predefined_db mode, fetch existing tags from database
    let existingDbTags: string[] | undefined;

    if (mode === "predefined_db") {
      existingDbTags = await listAllTagNames();
      aiLogger.debug({ existingTagCount: existingDbTags.length }, "Fetched existing DB tags");
    }

    const prompt = await buildAutoTaggingPrompt({ embedded: false, existingDbTags }, recipe);

    aiLogger.debug({ provider: providerName, prompt }, "Sending auto-tagging prompt to AI");

    const result = await generateText({
      model,
      output: Output.object({ schema: autoTaggingSchema }),
      prompt,
      system:
        "You are a recipe tagging assistant. Analyze the recipe and assign relevant tags based on the provided rules.",
      ...settings,
    });

    const output = result.output;

    if (!output) {
      aiLogger.error({ title: recipe.title }, "AI returned empty output for auto-tagging");

      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    // Validate the response
    if (!Array.isArray(output.tags)) {
      aiLogger.error({ title: recipe.title, output }, "Invalid auto-tagging response");

      return aiError("AI response missing tags array", "VALIDATION_ERROR");
    }

    // Normalize tags: lowercase, trim, deduplicate
    const normalizedTags = Array.from(
      new Set(output.tags.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 0))
    );

    aiLogger.info({ title: recipe.title, tags: normalizedTags }, "Auto-tagging completed");

    return aiSuccess(normalizedTags, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, title: recipe.title, code }, "Failed to generate tags");

    return aiError(message, code);
  }
}
