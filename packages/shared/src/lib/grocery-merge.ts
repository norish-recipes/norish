/**
 * Pure grocery merge rule shared by the frontend optimistic path and the
 * server's authoritative create (ADR-0009). Two groceries merge when their
 * normalized names and origin (recipe ingredient / recurring source) match
 * and their units are compatible; merging accumulates amounts onto the
 * existing row. The frontend applies this rule against its cached groceries
 * to pick a known canonical id; the server repeats it against authoritative
 * state and may pick a different canonical id after concurrent work.
 */

export type GroceryMergeSource = {
  name: string | null | undefined;
  unit?: string | null;
  amount?: number | null;
  recipeIngredientId?: string | null;
  recurringGroceryId?: string | null;
};

export type GroceryMergeCandidate = {
  id: string;
  name: string | null;
  unit: string | null;
  amount: number | null;
  isDone: boolean;
  recipeIngredientId?: string | null;
  recurringGroceryId?: string | null;
};

export function normalizeGroceryName(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().trim();
}

/**
 * Identity a grocery merges under: normalized name plus origin. Unnamed
 * groceries never merge and get no key.
 */
export function groceryMergeKey(grocery: GroceryMergeSource): string | null {
  const normalizedName = normalizeGroceryName(grocery.name);

  if (!normalizedName) return null;

  const recipeKey = grocery.recipeIngredientId ?? "manual";
  const recurringKey = grocery.recurringGroceryId ?? "none";

  return `${normalizedName}|${recipeKey}|${recurringKey}`;
}

export function unitsAreMergeCompatible(
  existingUnit: string | null | undefined,
  incomingUnit: string | null | undefined
): boolean {
  return existingUnit === incomingUnit || (!existingUnit && !incomingUnit);
}

export function accumulateGroceryAmounts(
  existingAmount: number | null | undefined,
  incomingAmount: number | null | undefined
): number {
  return (existingAmount ?? 1) + (incomingAmount ?? 1);
}

/**
 * Index merge candidates by key, first not-done candidate per key winning.
 * Callers processing a batch keep the index current by `set`ting the merged
 * or newly created row back under its key, so later batch items merge into
 * earlier ones exactly like the server does.
 */
export function buildGroceryMergeIndex<T extends GroceryMergeCandidate>(
  candidates: readonly T[]
): Map<string, T> {
  const index = new Map<string, T>();

  for (const grocery of candidates) {
    if (grocery.isDone) continue;

    const key = groceryMergeKey(grocery);

    if (key && !index.has(key)) {
      index.set(key, grocery);
    }
  }

  return index;
}

export function findGroceryMergeTarget<T extends GroceryMergeCandidate>(
  index: ReadonlyMap<string, T>,
  incoming: GroceryMergeSource
): T | null {
  const key = groceryMergeKey(incoming);
  const existing = key ? index.get(key) : undefined;

  if (!existing) return null;

  return unitsAreMergeCompatible(existing.unit, incoming.unit) ? existing : null;
}
