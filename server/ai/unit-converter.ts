import { generateText, Output } from "ai";

import { normalizeIngredient, normalizeStep } from "./helpers";
import { getModels, getGenerationSettings } from "./providers/registry";
import { conversionSchema, type ConversionOutput } from "./schemas/conversion.schema";
import { loadPrompt, fillPrompt } from "./prompts/loader";
import { aiSuccess, aiError, mapErrorToCode, getErrorMessage, type AIResult } from "./types/result";

import { isAIEnabled } from "@/config/server-config-loader";
import type { FullRecipeDTO, MeasurementSystem } from "@/types";
import { RecipeIngredientInputSchema, StepStepSchema } from "@/server/db/zodSchemas";
import { aiLogger } from "@/server/logger";

// Re-export types for consumers
export type { ConversionOutput };

export interface ConversionResult {
  ingredients: ReturnType<typeof normalizeIngredient>[];
  steps: ReturnType<typeof normalizeStep>[];
}

async function buildConversionPrompt(
  sourceSystem: MeasurementSystem,
  targetSystem: MeasurementSystem,
  recipe: FullRecipeDTO
): Promise<string> {
  const ingredients = recipe.recipeIngredients.map((i) => ({
    ingredientName: i.ingredientName,
    amount: i.amount ?? null,
    unit: i.unit ?? null,
    order: i.order,
    systemUsed: i.systemUsed,
  }));

  const steps = recipe.steps.map((s) => ({
    step: s.step,
    order: s.order,
    systemUsed: s.systemUsed,
  }));

  const units = targetSystem === "metric" ? "g, ml, L, kg, C" : "cups, tbsp, tsp, oz, lb, F";
  const template = await loadPrompt("unit-conversion");

  aiLogger.debug({ template }, "Loaded unit conversion prompt template");

  const filled = fillPrompt(template, { sourceSystem, targetSystem, units });

  return `${filled}
${JSON.stringify({ ingredients, steps }, null, 2)}`;
}

export async function convertRecipeDataWithAI(
  recipe: FullRecipeDTO,
  targetSystem: MeasurementSystem
): Promise<AIResult<ConversionResult>> {
  const sourceSystem = recipe.systemUsed;

  aiLogger.info(
    { recipeId: recipe.id, recipeName: recipe.name, sourceSystem, targetSystem },
    "Starting measurement conversion"
  );

  // Early return if no conversion needed
  if (sourceSystem === targetSystem) {
    aiLogger.debug({ recipeId: recipe.id }, "Source and target systems match, skipping conversion");

    return aiSuccess({
      ingredients: recipe.recipeIngredients.map((i) => normalizeIngredient(i, targetSystem)),
      steps: recipe.steps.map((s) => normalizeStep(s, targetSystem)),
    });
  }

  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, cannot convert measurements");
    return aiError("AI features are disabled", "AI_DISABLED");
  }

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();
    const prompt = await buildConversionPrompt(sourceSystem, targetSystem, recipe);

    aiLogger.debug(
      {
        recipeId: recipe.id,
        provider: providerName,
        ingredientCount: recipe.recipeIngredients.length,
        stepCount: recipe.steps.length,
      },
      "Sending conversion request to AI"
    );

    const result = await generateText({
      model,
      output: Output.object({ schema: conversionSchema }),
      prompt,
      system: "Convert recipe measurements between metric and US systems. Return valid JSON only.",
      ...settings,
    });

    const output = result.output;

    if (!output) {
      aiLogger.error(
        { recipeName: recipe.name, sourceSystem, targetSystem },
        "AI returned empty output for recipe conversion"
      );
      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    aiLogger.debug(
      {
        recipeId: recipe.id,
        convertedIngredients: output.ingredients?.length ?? 0,
        convertedSteps: output.steps?.length ?? 0,
      },
      "AI conversion response received"
    );

    // Validate the converted data against our schemas
    const ingredientsWithId = output.ingredients.map((i) => ({ ...i, ingredientId: "" }));
    const validatedIngredients = RecipeIngredientInputSchema.array().safeParse(ingredientsWithId);
    const validatedSteps = StepStepSchema.array().safeParse(output.steps);

    if (!validatedIngredients.success) {
      aiLogger.error(
        { recipeName: recipe.name, error: validatedIngredients.error.message },
        "Ingredient validation failed for AI conversion"
      );
      return aiError("AI response failed ingredient validation", "VALIDATION_ERROR");
    }

    if (!validatedSteps.success) {
      aiLogger.error(
        { recipeName: recipe.name, error: validatedSteps.error.message },
        "Step validation failed for AI conversion"
      );
      return aiError("AI response failed step validation", "VALIDATION_ERROR");
    }

    aiLogger.info(
      { recipeId: recipe.id, recipeName: recipe.name, targetSystem },
      "Measurement conversion completed"
    );

    return aiSuccess(
      {
        ingredients: validatedIngredients.data.map((i) => normalizeIngredient(i, targetSystem)),
        steps: validatedSteps.data.map((s) => normalizeStep(s, targetSystem)),
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

    aiLogger.error(
      { err: error, recipeId: recipe.id, recipeName: recipe.name, code },
      "Failed to convert recipe measurements"
    );

    return aiError(message, code);
  }
}
