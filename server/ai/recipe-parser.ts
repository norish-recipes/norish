import { generateText, Output } from "ai";

import { getModels, getGenerationSettings } from "./providers/registry";
import { recipeExtractionSchema, type RecipeExtractionOutput } from "./schemas/recipe.schema";
import { loadPrompt } from "./prompts/loader";
import { extractImageCandidates, extractSanitizedBody } from "./helpers";
import { aiSuccess, aiError, mapErrorToCode, getErrorMessage, type AIResult } from "./types/result";

import { isAIEnabled, getUnits } from "@/config/server-config-loader";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { normalizeRecipeFromJson } from "@/server/parser/normalize";
import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { aiLogger } from "@/server/logger";

// Re-export type for consumers
export type { RecipeExtractionOutput };

/**
 * Build the extraction prompt for recipe parsing.
 */
async function buildExtractionPrompt(
  url: string | undefined,
  html: string,
  allergies?: string[]
): Promise<string> {
  const sanitized = extractSanitizedBody(html);
  const truncated = sanitized.slice(0, 50000);

  const prompt = await loadPrompt("recipe-extraction");

  // Build allergy detection instruction
  let allergyInstruction = "";

  if (allergies && allergies.length > 0) {
    allergyInstruction = `
ALLERGY DETECTION (STRICT):
- The "keywords" array MUST contain ONLY items from this list: ${allergies.join(", ")}
- Do NOT add dietary tags, cuisine tags, or descriptive tags
- If none are present, return an empty array
- NEVER add additional keywords
`;
  } else {
    allergyInstruction =
      "\nALLERGY DETECTION: Skip allergy/dietary tag detection. Do not add any tags to the keywords array.";
  }

  return `${prompt}${allergyInstruction}
${url ? `URL: ${url}\n` : ""}
WEBPAGE TEXT:
${truncated}`;
}

export async function extractRecipeWithAI(
  html: string,
  url?: string,
  allergies?: string[]
): Promise<AIResult<FullRecipeInsertDTO>> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping extraction");
    return aiError("AI features are disabled", "AI_DISABLED");
  }

  aiLogger.info({ url }, "Starting AI recipe extraction");

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();
    const prompt = await buildExtractionPrompt(url, html, allergies);

    aiLogger.debug(
      { url, promptLength: prompt.length, provider: providerName },
      "Sending prompt to AI provider"
    );

    const result = await generateText({
      model,
      output: Output.object({ schema: recipeExtractionSchema }),
      prompt,
      system:
        "You extract recipe data as JSON-LD with both metric and US measurements. Return valid JSON only.",
      ...settings,
    });

    const jsonLd = result.output;

    if (!jsonLd || Object.keys(jsonLd).length === 0) {
      aiLogger.error({ url }, "Empty or null response from AI provider");
      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    aiLogger.debug(
      {
        url,
        recipeName: jsonLd.name,
        metricIngredients: jsonLd.recipeIngredient?.metric?.length ?? 0,
        usIngredients: jsonLd.recipeIngredient?.us?.length ?? 0,
        metricSteps: jsonLd.recipeInstructions?.metric?.length ?? 0,
        usSteps: jsonLd.recipeInstructions?.us?.length ?? 0,
      },
      "AI response received"
    );

    // Validate required fields
    if (
      !jsonLd.name ||
      !jsonLd.recipeIngredient?.metric?.length ||
      !jsonLd.recipeIngredient?.us?.length ||
      !jsonLd.recipeInstructions?.metric?.length ||
      !jsonLd.recipeInstructions?.us?.length
    ) {
      aiLogger.error({ url }, "Invalid recipe data - missing required fields");
      return aiError("Recipe extraction failed - missing required fields", "VALIDATION_ERROR");
    }

    // Extract image candidates from HTML
    const imageCandidates = extractImageCandidates(html);

    // Build metric version for normalization
    const metricVersion = {
      ...jsonLd,
      image: imageCandidates,
      recipeIngredient: jsonLd.recipeIngredient.metric,
      recipeInstructions: jsonLd.recipeInstructions.metric,
    };

    const normalized = await normalizeRecipeFromJson(metricVersion);

    if (!normalized) {
      aiLogger.error({ url }, "Failed to normalize recipe from JSON-LD");
      return aiError("Failed to normalize recipe data", "VALIDATION_ERROR");
    }

    // Parse US ingredients
    const units = await getUnits();
    const usIngredients = parseIngredientWithDefaults(jsonLd.recipeIngredient.us, units);
    const usSteps = jsonLd.recipeInstructions.us.map((step: string, i: number) => ({
      step,
      order: i + 1,
      systemUsed: "us" as const,
    }));

    // Combine both measurement systems
    normalized.url = url ?? null;
    normalized.recipeIngredients = [
      ...(normalized.recipeIngredients ?? []), // metric from normalizer
      ...usIngredients.map((ing, i) => ({
        ingredientId: null,
        ingredientName: ing.description,
        amount: ing.quantity != null ? ing.quantity : null,
        unit: ing.unitOfMeasureID,
        systemUsed: "us" as const,
        order: i,
      })),
    ];
    normalized.steps = [
      ...(normalized.steps ?? []), // metric from normalizer
      ...usSteps,
    ];

    aiLogger.info(
      {
        url,
        recipeName: normalized.name,
        totalIngredients: normalized.recipeIngredients?.length ?? 0,
        totalSteps: normalized.steps?.length ?? 0,
        systemUsed: normalized.systemUsed,
        tags: normalized.tags,
      },
      "AI recipe extraction completed"
    );

    return aiSuccess(normalized, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, url, code }, "Failed to extract recipe with AI");

    return aiError(message, code);
  }
}
