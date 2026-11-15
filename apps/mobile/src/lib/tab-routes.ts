/**
 * Each tab's path and the routes its stack presents, as Expo Router's typed hrefs. The tab bar
 * tells the tab by its path; screens and accessories push these.
 */
export const TAB_ROUTES = {
  recipes: {
    root: "/",
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
