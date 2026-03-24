import { generateObject } from "ai";

import { getModels, getGenerationSettings } from "@norish/shared-server/ai/providers";
import { provenanceInferenceSchema, type ProvenanceInferenceOutput } from "./schemas/origin.schema";
import { loadPrompt } from "@norish/shared-server/ai/prompts/loader";
import { aiSuccess, aiError, mapErrorToCode, getErrorMessage, type AIResult } from "./core/types";

import { isAIEnabled } from "@norish/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

export interface RecipeForProvenanceInference {
  title: string;
  description?: string | null;
  ingredients: string[];
}

/**
 * Infer the country of origin for a recipe using AI.
 *
 * @param recipe - The recipe data to analyze
 * @returns AIResult with the provenance data, or error
 */
export async function inferProvenanceForRecipe(
  recipe: RecipeForProvenanceInference
): Promise<AIResult<ProvenanceInferenceOutput>> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping origin inference");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  if (recipe.ingredients.length === 0) {
    aiLogger.warn("No ingredients provided for origin inference");

    return aiError("No ingredients provided", "INVALID_INPUT");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length },
    "Starting origin inference"
  );

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();

    const basePrompt = await loadPrompt("origin-inference");

    const ingredientsList = recipe.ingredients.map((i) => `- ${i}`).join("\n");

    const prompt = `${basePrompt}

RECIPE TO ANALYZE:
Title: ${recipe.title}
Description: ${recipe.description || "No description provided"}
Ingredients:
${ingredientsList}
`;

    aiLogger.debug({ provider: providerName, prompt }, "Sending origin inference prompt to AI");

    const result = await generateObject({
      model,
      schema: provenanceInferenceSchema,
      prompt,
      system: "You are a culinary provenance expert.",
      ...settings,
    });

    const { object } = result; // Destructure output from result

    if (!object || !object.originCountry) {
      aiLogger.error({ title: recipe.title }, "AI returned empty output for origin inference");

      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    aiLogger.info(
      { title: recipe.title, origin: object.originCountry },
      "Origin inference completed"
    );

    return aiSuccess(object, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, title: recipe.title, code }, "Failed to infer origin");

    return aiError(message, code);
  }
}
