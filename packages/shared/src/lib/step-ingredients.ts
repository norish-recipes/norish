/**
 * Step Ingredient resolution and amount derivation.
 *
 * A Step Ingredient is a step's use of one of the recipe's ingredient lines,
 * carried as a fractional share of that line. Nothing about the display is
 * stored: the amount a reader sees is always derived here, at the moment of
 * display, from the line as it currently stands — so it follows every edit
 * and the active measurement system by construction.
 *
 * References name their line by `order` within the step's own measurement
 * system (see the transport schema for why not row ids). Resolution is
 * strictly per system: metric steps resolve against metric lines.
 */

export interface StepIngredientRefLike {
  ingredientOrder: number;
  share: number;
  order?: number;
}

export interface StepIngredientLineLike {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
}

/** A Step Ingredient as a reading surface presents it. */
export interface ResolvedStepIngredient {
  /** The line's order — the reference key, stable for highlighting. */
  ingredientOrder: number;
  name: string;
  /** share × the line's current amount, or null when the line has none. */
  amount: number | null;
  unit: string | null;
  share: number;
}

/**
 * A line's amount as a positive number — database numerics arrive as
 * strings — or null when the line has none worth dividing by. The zero and
 * negative cases fold into null deliberately: a step ingredient entered as
 * an amount needs a divisor, and "0 flour" offers none.
 */
export function toLineAmount(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === "") return null;

  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * share × the line's current amount, rounded to four decimals so a third of
 * 50 reads as 16.6667 rather than a float tail. A line with no amount stays
 * amountless: the step then shows the name only.
 */
export function deriveStepIngredientAmount(
  lineAmount: number | null | undefined,
  share: number
): number | null {
  if (lineAmount == null) return null;

  return Math.round(lineAmount * share * 10000) / 10000;
}

/**
 * Resolve a step's references against the recipe's ingredient lines, in the
 * step's measurement system.
 *
 * A reference that finds no line — or lands on a `#` heading row, which is
 * never a Step Ingredient — resolves to nothing rather than something wrong.
 */
export function resolveStepIngredients(
  refs: readonly StepIngredientRefLike[],
  lines: readonly StepIngredientLineLike[],
  systemUsed: string
): ResolvedStepIngredient[] {
  if (refs.length === 0) return [];

  const linesByOrder = new Map<number, StepIngredientLineLike>();

  for (const line of lines) {
    if (line.systemUsed !== systemUsed) continue;
    if (line.ingredientName.trim().startsWith("#")) continue;
    if (!linesByOrder.has(line.order)) linesByOrder.set(line.order, line);
  }

  const resolved: ResolvedStepIngredient[] = [];
  const sorted = [...refs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const ref of sorted) {
    const line = linesByOrder.get(ref.ingredientOrder);

    if (!line) continue;

    resolved.push({
      ingredientOrder: ref.ingredientOrder,
      name: line.ingredientName,
      amount: deriveStepIngredientAmount(line.amount, ref.share),
      unit: line.unit,
      share: ref.share,
    });
  }

  return resolved;
}
