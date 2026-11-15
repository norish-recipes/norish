type Line = { ingredientId?: string | null };

/** The foods on the list, one-off and recurring: what its icons are read for, seeded or not. */
export function listFoodIds(list: {
  groceries: readonly Line[];
  recurringGroceries: readonly Line[];
}): (string | null | undefined)[] {
  return [...list.groceries, ...list.recurringGroceries].map((line) => line.ingredientId);
}
