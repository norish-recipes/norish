import { Ingredient } from "parse-ingredient";

import { MeasurementSystem } from "@/types";

const METRIC_UNITS = new Set([
  "g",
  "gram",
  "grams",
  "gr",
  "kg",
  "kilogram",
  "kilograms",
  "mg",
  "milligram",
  "milligrams",
  "ml",
  "milliliter",
  "milliliters",
  "millilitre",
  "millilitres",
  "cl",
  "centiliter",
  "centiliters",
  "dl",
  "deciliter",
  "deciliters",
  "l",
  "liter",
  "liters",
  "litre",
  "litres",
]);

const US_UNITS = new Set([
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "pint",
  "pints",
  "quart",
  "quarts",
  "gallon",
  "gallons",
  "oz",
  "ounce",
  "ounces",
  "fl oz",
  "fluid ounce",
  "fluid ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "stick",
  "sticks",
]);

const NEUTRAL_UNITS = new Set([
  "pinch",
  "dash",
  "dashes",
  "drizzle",
  "handful",
  "clove",
  "cloves",
  "sprig",
  "sprigs",
  "package",
  "packages",
  "pack",
  "packs",
  "can",
  "cans",
  "jar",
  "jars",
  "bottle",
  "bottles",
  "piece",
  "pieces",
  "slice",
  "slices",
  "portion",
  "portions",
  // Dutch localized spoons if your parser doesn't normalize them
  "tl",
  "theelepel",
  "theelepels",
  "el",
  "eetlepel",
  "eetlepels",
  // German localized spoons and portion units
  "esslöffel",
  "teelöffel",
  "prise",
  "prisen",
  "messerspitze",
  "messerspitzen",
  "handvoll",
  "schuss",
  "spritzer",
  "tropfen",
  "dose",
  "dosen",
  "packung",
  "packungen",
  "stück",
  "stücke",
  "scheibe",
  "scheiben",
  "zehe",
  "zehen",
]);

/** Normalize a unit token for lookup. */
function normalizeUnit(u?: string | null): string {
  return (u ?? "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export function getSystemHintForIngredient(ing: Ingredient): MeasurementSystem | null {
  if (ing.isGroupHeader) return null;

  const unitTokens = [normalizeUnit(ing.unitOfMeasureID), normalizeUnit(ing.unitOfMeasure)].filter(
    Boolean
  );

  for (const token of unitTokens) {
    if (NEUTRAL_UNITS.has(token)) return null;
    if (US_UNITS.has(token)) return "us";
    if (METRIC_UNITS.has(token)) return "metric";
  }

  const t = unitTokens[0] ?? "";

  if (t.endsWith("gram") || t.endsWith("grams")) return "metric";
  if (t.endsWith("liter") || t.endsWith("liters")) return "metric";
  if (t.endsWith("ounce") || t.endsWith("ounces")) return "us";
  if (t.endsWith("pound") || t.endsWith("pounds")) return "us";

  return null;
}

export function inferSystemUsedFromParsed(
  ingredients: Ingredient[],
  opts?: {
    defaultSystem?: MeasurementSystem;
    tieBreaker?: MeasurementSystem;
    requireThreshold?: number; // e.g. 0.6 means at least 60% must agree
  }
): MeasurementSystem {
  const defaultSystem = opts?.defaultSystem ?? "metric";
  const tieBreaker = opts?.tieBreaker ?? defaultSystem;
  const threshold = opts?.requireThreshold ?? 0.55;

  const counts = { us: 0, metric: 0 };

  for (const ing of ingredients) {
    const hint = getSystemHintForIngredient(ing);

    if (hint && counts[hint] !== undefined) counts[hint]++;
  }

  const total = counts.us + counts.metric;

  if (total === 0) return defaultSystem;

  // compute ratios
  const ratios = {
    us: counts.us / total,
    metric: counts.metric / total,
  };

  // clear winner?
  const maxKey = (Object.entries(ratios).sort((a, b) => b[1] - a[1])[0] ?? [
    tieBreaker,
  ])[0] as MeasurementSystem;
  const maxRatio = ratios[maxKey as keyof typeof ratios];

  if (maxRatio >= threshold) return maxKey;

  return tieBreaker;
}
