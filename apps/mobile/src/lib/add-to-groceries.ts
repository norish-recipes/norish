/** The Add to groceries route; a page passes the servings it shows, a card leaves them to the recipe. */
export function addToGroceriesRoute(recipeId: string, servings?: number) {
  return {
    pathname: "/add-to-groceries" as const,
    params: servings === undefined ? { recipeId } : { recipeId, servings: String(servings) },
  };
}

/** The servings the sheet opens at: the route's, when it is a positive number, else the recipe's. */
export function groceriesStartServings(param: string | undefined, fallback: number): number {
  const parsed = Number(param);

  return param && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
