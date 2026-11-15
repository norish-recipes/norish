import { routeUrl } from "./route-url";

/** Where a timer's notification and its Live Activity open: cook mode on the timer's step. */
export const cookModeRoute = (recipeId: string, step: number) =>
  ({ pathname: "/recipe/[id]/cook", params: { id: recipeId, step: String(step) } }) as const;

/** `cookModeRoute` as a link, for the Live Activity, which opens the app from outside. */
export function cookModeUrl(recipeId: string, step: number): string {
  const { pathname, params } = cookModeRoute(recipeId, step);

  return routeUrl(pathname, params);
}
