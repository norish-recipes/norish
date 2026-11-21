/** The servings the sheet opens at: the route's, when it is a positive number, else the recipe's. */
export function groceriesStartServings(param: string | undefined, fallback: number): number {
  const parsed = Number(param);

  return param && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
