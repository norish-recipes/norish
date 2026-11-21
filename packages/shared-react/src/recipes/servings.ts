/** The fewest servings a recipe scales to. */
export const MIN_SERVINGS = 0.125;

/** One step down: one fewer above two, then one, then halves down to the minimum. */
export function servingsDown(servings: number): number {
  if (servings <= 1) return Math.max(MIN_SERVINGS, servings / 2);
  if (servings <= 2) return 1;

  return servings - 1;
}

/** One step up: doubles below one serving, up to one, then one more. */
export function servingsUp(servings: number): number {
  return servings < 1 ? Math.min(1, servings * 2) : servings + 1;
}

/** The servings a page shows: the reader's pick, else the recipe's own, else one. */
export function servingsShown(picked: number | null, recipeServings: number | undefined): number {
  return picked ?? recipeServings ?? 1;
}
