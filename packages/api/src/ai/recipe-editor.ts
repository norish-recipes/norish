import { generateText, Output } from "ai";

import type { AIResult } from "@norish/shared-server/ai/types/result";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { getGenerationSettings, getModels } from "@norish/shared-server/ai/providers";
import {
  aiError,
  aiSuccess,
  getErrorMessage,
  mapErrorToCode,
} from "@norish/shared-server/ai/types/result";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type { RecipeExtractionOutput } from "./schemas/recipe.schema";
import {
  getExtractionLogContext,
  normalizeExtractionOutput,
  validateExtractionOutput,
} from "./features/recipe-extraction/normalizer";
import { buildRecipeEditPrompt } from "./prompts/builder";
import { recipeExtractionSchema } from "./schemas/recipe.schema";

// Re-export type for consumers
export type { RecipeExtractionOutput };

/**
 * Serialize an ingredient row into a human-readable string
 * (e.g. "200 g flour" or "2 eggs").
 */
function serializeIngredient(ingredient: {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
}): string {
  return [ingredient.amount ?? "", ingredient.unit ?? "", ingredient.ingredientName]
    .map((part) => String(part).trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * Serialize a FullRecipeDTO into the dual-system JSON representation the
 * edit prompt expects, so the model can edit in place and return the same shape.
 */
function serializeRecipeForEditing(recipe: FullRecipeDTO): string {
  const bySystem = <T extends { systemUsed: "metric" | "us"; order: number }>(
    items: T[],
    system: "metric" | "us"
  ): T[] => items.filter((i) => i.systemUsed === system).sort((a, b) => a.order - b.order);

  const current = {
    name: recipe.name,
    description: recipe.description,
    notes: recipe.notes,
    recipeYield: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    recipeIngredient: {
      metric: bySystem(recipe.recipeIngredients, "metric").map(serializeIngredient),
      us: bySystem(recipe.recipeIngredients, "us").map(serializeIngredient),
    },
    recipeInstructions: {
      metric: bySystem(recipe.steps, "metric").map((s) => s.step),
      us: bySystem(recipe.steps, "us").map((s) => s.step),
    },
    keywords: recipe.tags.map((t) => t.name),
    categories: recipe.categories,
    nutrition: {
      calories: recipe.calories,
      fat: recipe.fat,
      carbs: recipe.carbs,
      protein: recipe.protein,
    },
  };

  return JSON.stringify(current, null, 2);
}

/**
 * Edit an existing recipe using AI based on a natural-language instruction.
 *
 * The AI receives the current recipe (both metric and US systems) and the
 * instruction, and returns the full edited recipe. The result is normalized
 * into a FullRecipeInsertDTO ready to persist via the recipe update path.
 *
 * @param recipe - The current full recipe to edit.
 * @param instruction - The user's natural-language edit instruction.
 * @param recipeId - The recipe ID (used for image storage paths during normalization).
 * @param allergies - Optional list of allergens to keep flagged.
 * @returns AIResult with the edited recipe DTO, or error.
 */
export async function editRecipeWithAI(
  recipe: FullRecipeDTO,
  instruction: string,
  recipeId: string,
  allergies?: string[]
): Promise<AIResult<FullRecipeInsertDTO>> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping recipe edit");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  if (!instruction.trim()) {
    return aiError("No edit instruction provided", "INVALID_INPUT");
  }

  aiLogger.info({ recipeId, recipeName: recipe.name }, "Starting AI recipe edit");

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();

    const currentRecipeJson = serializeRecipeForEditing(recipe);
    const prompt = await buildRecipeEditPrompt(currentRecipeJson, instruction, { allergies });

    aiLogger.debug(
      { recipeId, promptLength: prompt.length, provider: providerName },
      "Sending recipe edit prompt to AI provider"
    );

    const result = await generateText({
      model,
      output: Output.object({ schema: recipeExtractionSchema }),
      prompt,
      system:
        "You edit recipe data and return it as JSON with both metric and US measurements. Apply only the requested change. Return valid JSON only.",
      ...settings,
    });

    const edited = result.output;

    const validation = validateExtractionOutput(edited);

    if (!validation.valid) {
      aiLogger.error({ recipeId, ...validation.details }, validation.error);

      return aiError(validation.error!, "VALIDATION_ERROR");
    }

    // Preserve existing image; media is not replaced by the edit.
    const normalized = await normalizeExtractionOutput(edited!, {
      recipeId,
      image: recipe.image ?? undefined,
    });

    if (!normalized) {
      aiLogger.error({ recipeId }, "Failed to normalize edited recipe");

      return aiError("Failed to normalize recipe data", "VALIDATION_ERROR");
    }

    aiLogger.info(
      { recipeId, ...getExtractionLogContext(edited!, normalized) },
      "AI recipe edit completed"
    );

    return aiSuccess(normalized, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, recipeId, code }, "Failed to edit recipe with AI");

    return aiError(message, code);
  }
}
