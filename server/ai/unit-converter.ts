import { normalizeIngredient, normalizeStep } from "./helpers";
import { conversionSchema } from "./schemas/conversion";
import { getAIProvider } from "./providers/factory";
import { loadPrompt, fillPrompt } from "./prompts/loader";

import { FullRecipeDTO, MeasurementSystem } from "@/types";
import { RecipeIngredientInputSchema, StepStepSchema } from "@/server/db/zodSchemas";
import { aiLogger } from "@/server/logger";

/* ------------------ PROMPT BUILDER ------------------ */
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

  const units = targetSystem === "metric" ? "g, ml, L, kg, °C" : "cups, tbsp, tsp, oz, lb, °F";
  const prompt = await loadPrompt("unit-conversion");
  aiLogger.debug({prompt}, "Loaded unit conversion prompt template");

  const filled = fillPrompt(prompt, { sourceSystem, targetSystem, units });

  return `${filled}
${JSON.stringify({ ingredients, steps }, null, 2)}`;
}

/* ------------------ MAIN CONVERTER ------------------ */
export async function convertRecipeDataWithAI(
  recipe: FullRecipeDTO,
  targetSystem: MeasurementSystem
) {
  const sourceSystem = recipe.systemUsed;

  aiLogger.info(
    { recipeId: recipe.id, recipeName: recipe.name, sourceSystem, targetSystem },
    "Starting measurement conversion"
  );

  if (sourceSystem === targetSystem) {
    aiLogger.debug({ recipeId: recipe.id }, "Source and target systems match, skipping conversion");

    return {
      ingredients: recipe.recipeIngredients,
      steps: recipe.steps,
    };
  }

  const provider = await getAIProvider();

  aiLogger.debug(
    {
      recipeId: recipe.id,
      ingredientCount: recipe.recipeIngredients.length,
      stepCount: recipe.steps.length,
    },
    "Sending conversion request to AI"
  );

  const obj = await provider.generateStructuredOutput<any>(
    await buildConversionPrompt(sourceSystem, targetSystem, recipe),
    conversionSchema,
    "Convert recipe measurements between metric and US systems. Return valid JSON only."
  );

  if (!obj) {
    aiLogger.error(
      { recipeName: recipe.name, sourceSystem, targetSystem },
      "AI returned null for recipe conversion"
    );

    return null;
  }

  aiLogger.debug(
    {
      recipeId: recipe.id,
      convertedIngredients: obj.ingredients?.length ?? 0,
      convertedSteps: obj.steps?.length ?? 0,
    },
    "AI conversion response received"
  );

  const ingredients = obj.ingredients.map((i: any) => ({ ...i, ingredientId: "" }));
  const validatedIngredients = RecipeIngredientInputSchema.array().safeParse(ingredients);
  const validatedSteps = StepStepSchema.array().safeParse(obj.steps);

  if (!validatedIngredients.success || !validatedSteps.success) {
    aiLogger.error(
      {
        recipeName: recipe.name,
        ingredientsValid: validatedIngredients.success,
        stepsValid: validatedSteps.success,
        ingredientsError: validatedIngredients.success
          ? undefined
          : validatedIngredients.error.message,
        stepsError: validatedSteps.success ? undefined : validatedSteps.error.message,
      },
      "Validation failed for AI conversion"
    );
    throw new Error("AI conversion validation failed");
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
