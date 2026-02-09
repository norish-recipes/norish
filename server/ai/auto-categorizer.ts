import type { RecipeCategory } from "@/types";

import { z } from "zod";
import { generateText, Output } from "ai";

import { getModels, getGenerationSettings } from "./providers";
import { matchCategory } from "./utils/category-matcher";
import { aiSuccess, aiError, mapErrorToCode, getErrorMessage, type AIResult } from "./types/result";

import { isAIEnabled } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";

const autoCategorizationSchema = z
  .object({
    categories: z
      .array(z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]))
      .describe("Array of meal categories for the recipe."),
  })
  .strict();

export async function categorizeRecipe(recipe: {
  title: string;
  description: string | null;
  ingredients: string[];
}): Promise<AIResult<RecipeCategory[]>> {
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping auto-categorization");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  if (recipe.ingredients.length === 0) {
    aiLogger.warn("No ingredients provided for auto-categorization");

    return aiError("No ingredients provided", "INVALID_INPUT");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length },
    "Starting auto-categorization"
  );

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();

    const prompt = [
      "Classify the recipe into one or more meal categories.",
      "Allowed categories: Breakfast, Lunch, Dinner, Snack.",
      "Return only the categories that fit the recipe.",
      `Title: ${recipe.title}`,
      `Description: ${recipe.description ?? ""}`,
      "Ingredients:",
      ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
    ].join("\n");

    aiLogger.debug({ provider: providerName, prompt }, "Sending auto-categorization prompt to AI");

    const result = await generateText({
      model,
      output: Output.object({ schema: autoCategorizationSchema }),
      prompt,
      system:
        "You are a culinary assistant that assigns breakfast/lunch/dinner/snack categories to recipes.",
      ...settings,
    });

    const output = result.output;

    if (!output) {
      aiLogger.error({ title: recipe.title }, "AI returned empty output for auto-categorization");

      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    if (!Array.isArray(output.categories)) {
      aiLogger.error({ title: recipe.title, output }, "Invalid auto-categorization response");

      return aiError("AI response missing categories array", "VALIDATION_ERROR");
    }

    const normalizedCategories = Array.from(
      new Set(
        output.categories
          .map((category) => matchCategory(category))
          .filter((category): category is RecipeCategory => Boolean(category))
      )
    );

    aiLogger.info(
      { title: recipe.title, categories: normalizedCategories },
      "Auto-categorization completed"
    );

    return aiSuccess(normalizedCategories, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, title: recipe.title, code }, "Failed to categorize recipe");

    return aiError(message, code);
  }
}
