/**
 * Ingredient parsing for JSON-LD recipe normalization.
 *
 * Handles Schema.org recipeIngredient arrays and strings.
 */

import type { MeasurementSystem } from "@/types/dto/recipe";
import type { UnitsMap } from "@/config/server-config-loader";

import { decode } from "html-entities";

import { parseIngredientWithDefaults } from "@/lib/helpers";
import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { normalizeUnit } from "@/lib/unit-localization";

export interface ParsedIngredient {
  ingredientId: null;
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: MeasurementSystem;
  order: number;
}

export interface IngredientParseResult {
  ingredients: ParsedIngredient[];
  systemUsed: MeasurementSystem;
}

/**
 * Normalize raw ingredient source to array of strings.
 *
 * Handles:
 * - Arrays of strings
 * - Single string (splits by newlines if needed)
 * - Null/undefined values filtered out
 *
 * @param ingSource - Raw recipeIngredient from JSON-LD
 * @returns Array of decoded ingredient strings
 */
function normalizeIngredientSource(ingSource: unknown): string[] {
  if (Array.isArray(ingSource)) {
    return ingSource.map((v) => (v != null ? decode(v.toString()) : "")).filter(Boolean);
  }

  if (typeof ingSource === "string") {
    return [decode(ingSource)];
  }

  return [];
}

/**
 * Parse ingredients from JSON-LD recipe data.
 */
export function parseIngredients(
  json: Record<string, unknown>,
  units: UnitsMap
): IngredientParseResult {
  const ingSource = json.recipeIngredient ?? json.ingredients;
  const rawIngredients = normalizeIngredientSource(ingSource);

  const parsed = parseIngredientWithDefaults(rawIngredients, units);
  const systemUsed = inferSystemUsedFromParsed(parsed);

  const ingredients: ParsedIngredient[] = parsed.map((ing, i) => ({
    ingredientId: null,
    ingredientName: ing.description,
    amount: ing.quantity != null ? ing.quantity : null,
    unit: normalizeUnit(ing.unitOfMeasure ?? "", units),
    systemUsed,
    order: i,
  }));

  return { ingredients, systemUsed };
}
