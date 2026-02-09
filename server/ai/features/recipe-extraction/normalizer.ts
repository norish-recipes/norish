/**
 * AI Recipe Extraction - Shared output normalization.
 *
 * Normalizes dual-system AI extraction output (metric + US) into
 * a FullRecipeInsertDTO with both measurement systems.
 */

import type { RecipeExtractionOutput } from "@/server/ai/schemas/recipe.schema";
import type { FullRecipeInsertDTO, RecipeCategory } from "@/types/dto/recipe";

import { decode } from "html-entities";

import { normalizeRecipeFromJson } from "@/server/parser/normalize";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { getUnits } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";
import { matchCategory } from "@/server/ai/utils/category-matcher";

/**
 * Options for normalizing AI extraction output.
 */
export interface NormalizeExtractionOptions {
  /**
   * Source URL of the recipe (for URL-based imports).
   */
  url?: string;

  /**
   * Image URL or path (for video imports with thumbnails).
   */
  image?: string;

  /**
   * Image candidates from HTML (for HTML-based imports).
   */
  imageCandidates?: string[];

  /**
   * Recipe ID (for image storage paths).
   */
  recipeId?: string;
}

/**
 * Validation result for AI extraction output.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    hasName: boolean;
    metricIngredients: number;
    usIngredients: number;
    metricSteps: number;
    usSteps: number;
  };
}

/**
 * Validate that AI extraction output has all required fields.
 */
export function validateExtractionOutput(output: RecipeExtractionOutput | null): ValidationResult {
  if (!output || Object.keys(output).length === 0) {
    return { valid: false, error: "AI returned empty response" };
  }

  const details = {
    hasName: !!output.name,
    metricIngredients: output.recipeIngredient?.metric?.length ?? 0,
    usIngredients: output.recipeIngredient?.us?.length ?? 0,
    metricSteps: output.recipeInstructions?.metric?.length ?? 0,
    usSteps: output.recipeInstructions?.us?.length ?? 0,
  };

  if (
    !output.name ||
    !output.recipeIngredient?.metric?.length ||
    !output.recipeIngredient?.us?.length ||
    !output.recipeInstructions?.metric?.length ||
    !output.recipeInstructions?.us?.length
  ) {
    return {
      valid: false,
      error: "Recipe extraction failed - missing required fields",
      details,
    };
  }

  return { valid: true, details };
}

/**
 * Normalize AI extraction output to FullRecipeInsertDTO.
 *
 * Takes the dual-system output from AI extraction (with both metric and US
 * measurements) and normalizes it to the internal DTO format with both
 * measurement systems preserved.
 *
 * @param output - The AI extraction output with metric and US systems.
 * @param options - Additional normalization options.
 * @returns The normalized recipe DTO, or null if normalization fails.
 */
export async function normalizeExtractionOutput(
  output: RecipeExtractionOutput,
  options: NormalizeExtractionOptions = {}
): Promise<FullRecipeInsertDTO | null> {
  const { url, image, imageCandidates, recipeId } = options;

  // Build metric version for base normalization
  // The AI schema doesn't include image - it comes from HTML/video metadata
  const metricVersion = {
    ...output,
    image: image ?? imageCandidates,
    recipeIngredient: output.recipeIngredient.metric,
    recipeInstructions: output.recipeInstructions.metric,
  };

  const normalized = await normalizeRecipeFromJson(metricVersion, recipeId);

  if (!normalized) {
    aiLogger.warn(
      {
        recipeName: output.name,
        metricIngredients: output.recipeIngredient?.metric?.length ?? 0,
        metricSteps: output.recipeInstructions?.metric?.length ?? 0,
      },
      "Failed to normalize recipe from JSON-LD - normalizeRecipeFromJson returned null"
    );

    return null;
  }

  // Parse US ingredients and steps
  const units = await getUnits();
  const usIngredients = parseIngredientWithDefaults(
    output.recipeIngredient.us.map((ing: string) => decode(ing)),
    units
  );
  const usSteps = output.recipeInstructions.us.map((step: string, i: number) => ({
    step: decode(step),
    order: i + 1,
    systemUsed: "us" as const,
  }));

  // Set URL if provided
  normalized.url = url ?? null;
  normalized.notes = typeof output.notes === "string" ? decode(output.notes) : null;

  // Combine both measurement systems
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

  const normalizedCategories = (output.categories ?? [])
    .filter((category): category is string => typeof category === "string" && category.length > 0)
    .map((category) => matchCategory(category))
    .filter((category): category is RecipeCategory => category !== null)
    .filter((category, index, categories) => categories.indexOf(category) === index);

  normalized.categories = normalizedCategories;

  // Log if no categories were matched (helps debug AI responses)
  if (normalizedCategories.length === 0 && (output.categories?.length ?? 0) > 0) {
    aiLogger.warn(
      { rawCategories: output.categories, recipeName: output.name },
      "AI returned categories but none matched valid category names"
    );
  }

  return normalized;
}

/**
 * Get logging context for AI extraction results.
 */
export function getExtractionLogContext(
  output: RecipeExtractionOutput,
  normalized: FullRecipeInsertDTO | null
): Record<string, unknown> {
  return {
    recipeName: output.name,
    metricIngredients: output.recipeIngredient?.metric?.length ?? 0,
    usIngredients: output.recipeIngredient?.us?.length ?? 0,
    metricSteps: output.recipeInstructions?.metric?.length ?? 0,
    usSteps: output.recipeInstructions?.us?.length ?? 0,
    ...(normalized && {
      totalIngredients: normalized.recipeIngredients?.length ?? 0,
      totalSteps: normalized.steps?.length ?? 0,
      systemUsed: normalized.systemUsed,
      tags: normalized.tags,
    }),
    categories: output.categories,
  };
}
