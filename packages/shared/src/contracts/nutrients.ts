/** The nutrients beyond calories and macros, one list for every reader: per 100 g for a food,
 * per serving for a recipe, in the unit named here; a missing key is unknown, never zero. */
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

/** The nutrients a language model estimates, those a cook's knowledge reaches; minerals and
 * vitamins come only from the datasets that measured them. */
export const ESTIMATED_EXTRA_NUTRIENTS = [
  "saturatedFat",
  "sugars",
  "fiber",
  "sodium",
] as const satisfies readonly ExtraNutrient[];

export type ExtraNutrients = Partial<Record<ExtraNutrient, number>>;

/** Fills each estimated extra a model's answer leaves out with null (unknown): strict outputs
 * keep them required, but an answer without them still counts for its four values. */
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
  z.number().nonnegative()
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
