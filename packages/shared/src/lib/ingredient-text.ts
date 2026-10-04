import { foldName } from "./fold-name";
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

