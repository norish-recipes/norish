import type { ExtraNutrient, ExtraNutrients } from "@norish/shared/contracts/nutrients";

/**
 * A composition table's value, as Ingredient Nutrition reads it (ADR-0039):
 * a number (a decimal comma or point), "traces" as 0, "< x" as half of x,
 * and anything else ("-", blank, a note) as no value.
 */
export function compositionValue(raw: string | null | undefined): number | null {
  const text = (raw ?? "").trim().toLowerCase().replace(",", ".");

  if (text === "") return null;
  if (text === "traces" || text === "trace" || text === "tr" || text === "tr.") return 0;

  const below = /^<\s*(\d+(?:\.\d+)?)$/.exec(text);

  if (below) return round(Number(below[1]) / 2);

  const number = /^-?\d+(?:\.\d+)?(?:e-?\d+)?$/.test(text) ? Number(text) : Number.NaN;

  return Number.isFinite(number) && number >= 0 ? round(number) : null;
}

/** Numbers as the table keeps them: four decimals at most, so a rebuild diffs cleanly. */
export function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** The four numbers per 100 g, or null where any of them is missing: such a row is skipped. */
export interface Macros {
  kcal: number;
  fat: number;
  carbs: number;
  protein: number;
}

export function macros(values: {
  kcal: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
}): Macros | null {
  const { kcal, fat, carbs, protein } = values;

  return kcal === null || fat === null || carbs === null || protein === null
    ? null
    : { kcal, fat, carbs, protein };
}

/** The other nutrients a row gives, dropping the ones it does not: a missing value is unknown, not zero. */
export function extrasOf(values: Partial<Record<ExtraNutrient, number | null>>): ExtraNutrients {
  const known: ExtraNutrients = {};

  for (const [key, value] of Object.entries(values) as Array<[ExtraNutrient, number | null]>) {
    if (value !== null && value !== undefined) known[key] = round(value);
  }

  return known;
}

/** Vitamin A as retinol activity equivalents: retinol plus a twelfth of beta-carotene, where either is known. */
export function vitaminA(retinol: number | null, betaCarotene: number | null): number | null {
  return retinol === null && betaCarotene === null
    ? null
    : (retinol ?? 0) + (betaCarotene ?? 0) / 12;
}
