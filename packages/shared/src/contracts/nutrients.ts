/**
 * The nutrients Norish knows beyond calories and the three macros: one list
 * that the source table, Ingredient Nutrition, a recipe's own Nutrition
 * Information, the language model's estimate, the API and the recipe page all
 * read. Each value is per 100 g for a food and per serving for a recipe, in
 * the unit named here, and is only present where it is known: a missing key
 * means unknown, never zero.
 */
import { z } from "zod";

export const EXTRA_NUTRIENTS = [
  "saturatedFat",
  "monounsaturatedFat",
  "polyunsaturatedFat",
  "transFat",
  "sugars",
  "fiber",
  "cholesterol",
  "sodium",
  "potassium",
  "calcium",
  "iron",
  "vitaminC",
  "vitaminA",
] as const;

export type ExtraNutrient = (typeof EXTRA_NUTRIENTS)[number];

/** Grams, milligrams, or micrograms (vitamin A as retinol activity equivalents). */
export const EXTRA_NUTRIENT_UNITS: Record<ExtraNutrient, "g" | "mg" | "µg"> = {
  saturatedFat: "g",
  monounsaturatedFat: "g",
  polyunsaturatedFat: "g",
  transFat: "g",
  sugars: "g",
  fiber: "g",
  cholesterol: "mg",
  sodium: "mg",
  potassium: "mg",
  calcium: "mg",
  iron: "mg",
  vitaminC: "mg",
  vitaminA: "µg",
};

/**
 * The nutrients a language model is asked to estimate: the ones a cook's
 * knowledge of the ingredients reaches. Minerals and vitamins come only from
 * the datasets, which measured them.
 */
export const ESTIMATED_EXTRA_NUTRIENTS = [
  "saturatedFat",
  "sugars",
  "fiber",
  "sodium",
] as const satisfies readonly ExtraNutrient[];

export type ExtraNutrients = Partial<Record<ExtraNutrient, number>>;

/**
 * A language model's answer schema in which each estimated extra it leaves
 * out reads as null (unknown). The extras stay required in the JSON schema the
 * model is given, as strict structured outputs need, but an answer without
 * them, from a provider that drops them or a fixture written before them, is
 * not refused whole: the four values it does give still count.
 */
export function missingExtrasAsNull<T extends z.ZodType>(schema: T) {
  const unknown = Object.fromEntries(ESTIMATED_EXTRA_NUTRIENTS.map((key) => [key, null]));

  return z.preprocess(
    (value) =>
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? { ...unknown, ...value }
        : value,
    schema
  );
}

export const ExtraNutrientsSchema = z.partialRecord(
  z.enum(EXTRA_NUTRIENTS),
  z.number().finite().nonnegative()
);

/** The extras present in `values`, finite and not negative, dropping anything else. */
export function knownExtras(values: object | null | undefined): ExtraNutrients {
  const known: ExtraNutrients = {};

  for (const key of EXTRA_NUTRIENTS) {
    const value = (values as Record<string, unknown> | null | undefined)?.[key];
    const parsed = typeof value === "string" ? Number.parseFloat(value) : value;

    if (typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0) known[key] = parsed;
  }

  return known;
}
