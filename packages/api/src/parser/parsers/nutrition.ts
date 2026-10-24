/**
 * Nutrition parsing utilities for JSON-LD recipe normalization.
 *
 * Extracts and normalizes nutrition information from Schema.org Recipe nodes.
 */
import type { ExtraNutrients } from "@norish/shared/contracts/nutrients";

export interface ParsedNutrition {
  calories: number | null;
  fat: string | null;
  carbs: string | null;
  protein: string | null;
  /** The other nutrients the source states, per serving; null where it states none. */
  extras: ExtraNutrients | null;
}

/**
 * Parse a nutrition value from various formats.
 *
 * Handles:
 * - Numbers: 300
 * - Strings with units: "300 kcal", "25g", "25 grams"
 *
 * @param value - The raw nutrition value
 * @returns The parsed numeric value, or null if invalid
 */
export function parseNutritionValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Extract numeric portion (handles "300 kcal", "25g", "25 grams", etc.)
    const match = value.match(/^[\d.,]+/);

    if (match) {
      const parsed = parseFloat(match[0].replace(",", "."));

      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

/**
 * Extract nutrition information from a JSON-LD recipe node.
 *
 * Supports Schema.org NutritionInformation with fields like:
 * - calories / calorieContent
 * - fatContent / fat
 * - carbohydrateContent / carbs
 * - proteinContent / protein
 *
 * @param json - The JSON-LD recipe node
 * @returns Parsed nutrition object with all fields (null if not available)
 */
export function extractNutrition(json: unknown): ParsedNutrition {
  const defaultResult: ParsedNutrition = {
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
    extras: null,
  };

  if (!json || typeof json !== "object") return defaultResult;

  const node = json as Record<string, unknown>;
  const nutrition = node.nutrition;

  if (!nutrition || typeof nutrition !== "object") return defaultResult;

  const nutritionObj = nutrition as Record<string, unknown>;

  const calories = parseNutritionValue(nutritionObj.calories ?? nutritionObj.calorieContent);
  const fat = parseNutritionValue(nutritionObj.fatContent ?? nutritionObj.fat);
  const carbs = parseNutritionValue(nutritionObj.carbohydrateContent ?? nutritionObj.carbs);
  const protein = parseNutritionValue(nutritionObj.proteinContent ?? nutritionObj.protein);

  const extras: ExtraNutrients = {};
  const add = (key: keyof ExtraNutrients, value: number | null) => {
    if (value != null && value >= 0) extras[key] = value;
  };

  add(
    "saturatedFat",
    parseNutritionValue(nutritionObj.saturatedFatContent ?? nutritionObj.saturatedFat)
  );
  add("transFat", parseNutritionValue(nutritionObj.transFatContent ?? nutritionObj.transFat));
  add("sugars", parseNutritionValue(nutritionObj.sugarContent ?? nutritionObj.sugars));
  add("fiber", parseNutritionValue(nutritionObj.fiberContent ?? nutritionObj.fiber));
  add("cholesterol", parseMilligrams(nutritionObj.cholesterolContent ?? nutritionObj.cholesterol));
  add("sodium", parseMilligrams(nutritionObj.sodiumContent ?? nutritionObj.sodium));

  return {
    calories: calories != null ? Math.round(calories) : null,
    fat: fat != null ? fat.toString() : null,
    carbs: carbs != null ? carbs.toString() : null,
    protein: protein != null ? protein.toString() : null,
    extras: Object.keys(extras).length > 0 ? extras : null,
  };
}

/**
 * A value schema.org states in milligrams by convention ("480 mg"), read as
 * milligrams whichever mass unit it is written in: "0.48 g" is 480 mg.
 */
export function parseMilligrams(value: unknown): number | null {
  const parsed = parseNutritionValue(value);

  if (parsed == null || typeof value !== "string") return parsed;

  const unit = value
    .replace(/^[\d.,\s]+/, "")
    .trim()
    .toLowerCase();

  if (unit.startsWith("mg") || unit.startsWith("milligram")) return parsed;
  if (unit.startsWith("µg") || unit.startsWith("mcg") || unit.startsWith("microgram")) {
    return parsed / 1000;
  }
  if (unit.startsWith("g") || unit.startsWith("gram")) return parsed * 1000;

  return parsed;
}
