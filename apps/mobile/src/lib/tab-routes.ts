/** Each tab's path and the routes its stack presents, as Expo Router's typed hrefs. The tab bar
 * tells the tab by its path; screens and accessories push these. */
export const TAB_ROUTES = {
  recipes: {
    root: "/",
    recipe: "/recipe/[id]",
    cook: "/recipe/[id]/cook",
    servings: "/recipe/[id]/servings",
    edit: "/recipe/[id]/edit",
    share: "/recipe/[id]/share",
    viewer: "/recipe/[id]/viewer",
    cookbook: "/cookbook/[id]",
    newCookbook: "/new-cookbook",
    planRecipe: "/plan-recipe",
    move: "/move",
    addToGroceries: "/add-to-groceries",
    cookbookAddRecipes: "/cookbook-add-recipes",
  },
  groceries: {
    root: "/groceries",
    add: "/groceries/add",
    stores: "/groceries/stores",
    pantry: "/groceries/pantry",
    pantryAdd: "/groceries/pantry-add",
    food: "/groceries/food",
  },
  calendar: {
    root: "/calendar",
    item: "/calendar/item",
    planRecipe: "/calendar/plan-recipe",
    addToGroceries: "/calendar/add-to-groceries",
  },
} as const;

/** An Add to groceries a tab's stack presents. */
export type AddToGroceriesRoute =
  typeof TAB_ROUTES.recipes.addToGroceries | typeof TAB_ROUTES.calendar.addToGroceries;

/** A recipe's page, or one of the routes its own stack presents. */
export const recipeRoute = (
  id: string,
  route: "recipe" | "servings" | "edit" | "share" = "recipe"
) => ({ pathname: TAB_ROUTES.recipes[route], params: { id } }) as const;

/** The recipe whose page, or a route its stack presents, `path` is: `recipeRoute` read back. */
export const recipeIdOf = (path: string) => /^\/recipe\/([^/]+)(?:\/|$)/.exec(path)?.[1];

/** A cookbook's page. */
export const cookbookRoute = (id: string) =>
  ({ pathname: TAB_ROUTES.recipes.cookbook, params: { id } }) as const;

/** The cookbook whose page `path` is: `cookbookRoute` read back. */
export const cookbookIdOf = (path: string) => /^\/cookbook\/([^/]+)$/.exec(path)?.[1];

/** Whose photos the viewer shows: the page's step by `order`, or cook mode's by `stepNumber`. */
export type ViewerStep = { order: number } | { stepNumber: number };

/** The viewer route's own params: `step` names a page step, `cook` a cook-mode step. */
export type ViewerParams = { start?: string; step?: string; cook?: string };

/** The full-screen media viewer: the hero's items, or one step's photos, from `start`. */
export const mediaViewerRoute = (recipeId: string, start: number, step?: ViewerStep) =>
  ({
    pathname: TAB_ROUTES.recipes.viewer,
    params: {
      id: recipeId,
      start: String(start),
      ...(step === undefined
        ? {}
        : "order" in step
          ? { step: String(step.order) }
          : { cook: String(step.stepNumber) }),
    },
  }) as const;

/** `mediaViewerRoute`'s params read back: where to start, and the step, none for the hero. */
export function viewerParamsOf({ start, step, cook }: ViewerParams) {
  const viewerStep: ViewerStep | undefined =
    step !== undefined
      ? { order: Number(step) }
      : cook !== undefined
        ? { stepNumber: Number(cook) }
        : undefined;

  return { start: Number(start) || 0, step: viewerStep };
}

/** Cook mode, on the timer's step when a notification or the Live Activity opens it. */
export const cookModeRoute = (recipeId: string, step?: number) =>
  ({
    pathname: TAB_ROUTES.recipes.cook,
    params: step === undefined ? { id: recipeId } : { id: recipeId, step: String(step) },
  }) as const;

/** The step cook mode opens on from its `step` param: the first for a timer with none. */
export const cookStepOf = (step?: string) => Number(step ?? 0) || 0;

/** The Add to groceries route; a page passes the servings it shows, a card leaves them to the recipe. */
export function addToGroceriesRoute(recipeId: string, servings?: number) {
  return {
    pathname: TAB_ROUTES.recipes.addToGroceries,
    params: servings === undefined ? { recipeId } : { recipeId, servings: String(servings) },
  };
}
