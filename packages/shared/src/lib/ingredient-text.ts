/**
 * Whether a recipe line is a heading ("# For the sauce"): it groups the lines
 * below it and names no food, so it is never resolved, counted or bought.
 */
export function isIngredientHeading(text: string | null | undefined): boolean {
  return (text ?? "").trim().startsWith("#");
}

/**
 * Whether a recipe line's text names no food: a heading, a text with no
 * letter or digit in any script (")", "—"), or the "[object Object]" an old
 * import wrote where it meant a name. Kept as written, and given no alias.
 */
export function namesNoFood(text: string | null | undefined): boolean {
  const trimmed = (text ?? "").trim();

  return (
    isIngredientHeading(trimmed) || !/[\p{L}\p{N}]/u.test(trimmed) || trimmed === "[object Object]"
  );
}
