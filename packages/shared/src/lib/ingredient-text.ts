import type { UnitsMap } from "@norish/config/zod/server-config";

import { foldName } from "./fold-name";
import { parseIngredientWithDefaults } from "./helpers";
import { isMeasure, resolveUnit } from "./units";

/**
 * Whether a recipe line is a heading ("# For the sauce"): it groups the lines
 * below it and names no food, so it is never resolved, counted or bought.
 */
export function isIngredientHeading(text: string | null | undefined): boolean {
  return (text ?? "").trim().startsWith("#");
}

/**
 * Whether a text is an amount alone: numbers, weights and volumes, written
 * apart or together ("el", "1 el", "200g"), as an import left a line whose
 * food it lost.
 */
function isAmountAlone(text: string): boolean {
  return foldName(text)
    .split(" ")
    .every((word) => {
      const unit = /^\p{N}*(\p{L}*)$/u.exec(word)?.[1];

      return unit !== undefined && (unit === "" || isMeasure(resolveUnit(unit)));
    });
}

/**
 * Whether a recipe line's text names no food: a heading, a text with no
 * letter or digit in any script (")", "—"), the "[object Object]" an old
 * import wrote where it meant a name, or an amount alone. Kept as written,
 * and given no alias.
 */
export function namesNoFood(text: string | null | undefined): boolean {
  const trimmed = (text ?? "").trim();

  return (
    isIngredientHeading(trimmed) ||
    !/[\p{L}\p{N}]/u.test(trimmed) ||
    trimmed === "[object Object]" ||
    isAmountAlone(trimmed)
  );
}

/** A recipe line's text as written, and the amount and unit it keeps apart from it. */
export interface RecipeLineText {
  text: string;
  /** As stored or sent: a number, a numeric string, or nothing. */
  amount?: unknown;
  unit?: string | null;
}

/**
 * The text a recipe line's food is resolved from: its text as written, except
 * where an import kept the line's number apart and left its unit in the text
 * ("150 | – | GR CHERRYTOMATEN", "1 | – | rol bladerdeeg"). Such a line is
 * read as the recipe editor reads it, number in front, and its food is what
 * the parser leaves once it has taken the unit: "CHERRYTOMATEN", "bladerdeeg".
 * The line keeps its text, amount and unit as written, and its text becomes
 * no spelling of the food. Never without a number: alone, a unit word at the
 * start of a text may be the food's own ("glass noodles").
 */
export function lineFoodText({ text, amount, unit }: RecipeLineText, units: UnitsMap): string {
  const count = amount === null || amount === undefined || amount === "" ? NaN : Number(amount);

  if (unit || !Number.isFinite(count)) return text;

  const [read] = parseIngredientWithDefaults(`${count} ${text}`, units);
  const food = read?.description.replace(/\s+/g, " ").trim() ?? "";

  return (read?.unitOfMeasureID ?? read?.unitOfMeasure) && food ? food : text;
}
