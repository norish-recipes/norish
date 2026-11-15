/**
 * Each tab's path and the routes its stack presents, as Expo Router's typed hrefs. The tab bar
 * tells the tab by its path; screens and accessories push these.
 */
export const TAB_ROUTES = {
  recipes: {
    root: "/",
    recipe: "/recipe/[id]",
    cook: "/recipe/[id]/cook",
    servings: "/recipe/[id]/servings",
    edit: "/recipe/[id]/edit",
    share: "/recipe/[id]/share",
    planRecipe: "/plan-recipe",
    addToGroceries: "/add-to-groceries",
    cookbookAddRecipes: "/cookbook-add-recipes",
  },
  groceries: {
    root: "/groceries",
    add: "/groceries/add",
    stores: "/groceries/stores",
    pantry: "/groceries/pantry",
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

/** Cook mode, on the timer's step when a notification or the Live Activity opens it. */
export const cookModeRoute = (recipeId: string, step?: number) =>
  ({
    pathname: TAB_ROUTES.recipes.cook,
    params: step === undefined ? { id: recipeId } : { id: recipeId, step: String(step) },
  }) as const;

/** The Add to groceries route; a page passes the servings it shows, a card leaves them to the recipe. */
export function addToGroceriesRoute(recipeId: string, servings?: number) {
  return {
    pathname: TAB_ROUTES.recipes.addToGroceries,
    params: servings === undefined ? { recipeId } : { recipeId, servings: String(servings) },
  };
}
