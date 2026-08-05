import type { FullRecipeDTO, MeasurementSystem } from "@norish/shared/contracts";
import { aiLogger } from "@norish/shared-server/logger";
import { RecipeIngredientInputSchema, StepStepSchema } from "@norish/shared/contracts/zod";

import type { ConversionOutput } from "./conversion.schema";
import { AIResponseError } from "../runtime/errors";
import { generateStructured } from "../runtime/runtime";
import { conversionSchema } from "./conversion.schema";

// Re-export types for consumers
export type { ConversionOutput };

function normalizeIngredient(i: any, system: MeasurementSystem) {
  return {
    ingredientId: null,
    ingredientName: String(i.ingredientName || "").trim(),
    order: i.order ?? 0,
    amount: i.amount == null ? null : Number(i.amount),
    unit: i.unit ? String(i.unit).trim() : null,
    systemUsed: system,
  };
}

function normalizeStep(s: any, system: MeasurementSystem) {
  return {
    step: String(s.step || "").trim(),
    order: s.order ?? 0,
    systemUsed: system,
  };
}

export interface ConversionResult {
  ingredients: ReturnType<typeof normalizeIngredient>[];
  steps: ReturnType<typeof normalizeStep>[];
}

export async function convertRecipeDataWithAI(
  recipe: FullRecipeDTO,
  targetSystem: MeasurementSystem
): Promise<ConversionResult> {
  const sourceSystem = recipe.systemUsed;

  aiLogger.info(
    { recipeId: recipe.id, recipeName: recipe.name, sourceSystem, targetSystem },
    "Starting measurement conversion"
  );

  // Early return if no conversion needed
  if (sourceSystem === targetSystem) {
    aiLogger.debug({ recipeId: recipe.id }, "Source and target systems match, skipping conversion");

    return {
      ingredients: recipe.recipeIngredients.map((i) => normalizeIngredient(i, targetSystem)),
      steps: recipe.steps.map((s) => normalizeStep(s, targetSystem)),
    };
  }

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

  const output = await generateStructured({
    prompt: "unit-conversion",
    schema: conversionSchema,
    fill: { sourceSystem, targetSystem, units },
    sections: [JSON.stringify({ ingredients, steps }, null, 2)],
  });

  aiLogger.debug(
    {
      recipeId: recipe.id,
      convertedIngredients: output.ingredients?.length ?? 0,
      convertedSteps: output.steps?.length ?? 0,
    },
    "AI conversion response received"
  );

  // The conversion must land in the recipe contracts' own shape — a stricter
  // bar than the request schema, and the one the write path depends on.
  const ingredientsWithId = output.ingredients.map((i) => ({ ...i, ingredientId: "" }));
  const validatedIngredients = RecipeIngredientInputSchema.array().safeParse(ingredientsWithId);
  const validatedSteps = StepStepSchema.array().safeParse(output.steps);

  if (!validatedIngredients.success) {
    aiLogger.error(
      { recipeName: recipe.name, error: validatedIngredients.error.message },
      "Ingredient validation failed for AI conversion"
    );

    throw new AIResponseError("The converted ingredients did not match the recipe contract.");
  }

  if (!validatedSteps.success) {
    aiLogger.error(
      { recipeName: recipe.name, error: validatedSteps.error.message },
      "Step validation failed for AI conversion"
    );

    throw new AIResponseError("The converted steps did not match the recipe contract.");
  }

  aiLogger.info(
    { recipeId: recipe.id, recipeName: recipe.name, targetSystem },
    "Measurement conversion completed"
  );

  return {
    ingredients: validatedIngredients.data.map((i) => normalizeIngredient(i, targetSystem)),
    steps: validatedSteps.data.map((s) => normalizeStep(s, targetSystem)),
  };
}
