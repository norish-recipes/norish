/**
 * Ingredient parsing for JSON-LD recipe normalization.
 *
 * Handles Schema.org recipeIngredient arrays and strings.
 */

import { decode } from "html-entities";

import type { UnitsMap } from "@norish/shared-server/config/server-config-loader";
import type { MeasurementSystem } from "@norish/shared/contracts/dto/recipe";
import { inferSystemUsedFromParsed } from "@norish/shared/lib/determine-recipe-system";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { normalizeUnit } from "@norish/shared/lib/unit-localization";

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

function ingredientEntryText(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return "";
  const { text, name } = entry as Record<string, unknown>;

  if (typeof text === "string") return text;

  return typeof name === "string" ? name : "";
}

/**
 * Normalize raw ingredient source to array of strings.
 *
 * Handles:
 * - Arrays of strings, or objects read by their `text`, else their `name`
 * - Single string (splits by newlines if needed)
 * - Any other entry dropped
 *
 * @param ingSource - Raw recipeIngredient from JSON-LD
 * @returns Array of decoded ingredient strings
 */
function normalizeIngredientSource(ingSource: unknown): string[] {
  if (Array.isArray(ingSource)) {
    return ingSource.map((v) => decode(ingredientEntryText(v))).filter(Boolean);
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
