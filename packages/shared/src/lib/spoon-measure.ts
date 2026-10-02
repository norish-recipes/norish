/**
 * The measure an Ingredient's spoon weight is shown and corrected in
 * (ADR-0039, spoon measures): the one its household's recipes measure it in
 * most, so cumin reads "a teaspoon weighs 2 g" and flour "a cup weighs
 * 125 g", or per 100 ml for the metric volumes. The stored fact stays a
 * density; only the words around it change.
 */
import { resolveUnit } from "./units";

/** Teaspoon, tablespoon and cup by their own sizes; millilitres to litres per 100 ml. */
export const SPOON_MEASURES = ["teaspoon", "tablespoon", "cup", "100ml"] as const;

export type SpoonMeasure = (typeof SPOON_MEASURES)[number];

/** How many millilitres each measure holds: the unit table's sizes. */
export const SPOON_MEASURE_ML: Record<SpoonMeasure, number> = {
  teaspoon: 5,
  tablespoon: 15,
  cup: 240,
  "100ml": 100,
};

/** The measure a line's unit is read in, or null for a unit that measures no volume. */
export function spoonMeasureOf(unit: string | null | undefined): SpoonMeasure | null {
  const resolved = resolveUnit(unit);

  if (resolved?.family !== "volume") return null;
  if (resolved.id === "teaspoon" || resolved.id === "tablespoon" || resolved.id === "cup") {
    return resolved.id;
  }

  return "100ml";
}

/**
 * The measure most lines use, from how many lines use each unit; a tie goes
 * to the smaller measure. Null where no line measures by volume.
 */
export function mostUsedSpoonMeasure(
  units: ReadonlyArray<{ unit: string | null; lines: number }>
): SpoonMeasure | null {
  const lines = new Map<SpoonMeasure, number>();

  for (const { unit, lines: count } of units) {
    const measure = spoonMeasureOf(unit);

    if (measure) lines.set(measure, (lines.get(measure) ?? 0) + count);
  }

  let most: SpoonMeasure | null = null;

  for (const measure of SPOON_MEASURES) {
    if ((lines.get(measure) ?? 0) > (most ? (lines.get(most) ?? 0) : 0)) most = measure;
  }

  return most;
}
