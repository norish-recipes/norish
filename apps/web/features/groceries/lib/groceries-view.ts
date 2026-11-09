export type GroceriesView = "list" | "pantry";

/** The view an address shows: the root reads it off the address bar, the layout off the request. */
export function groceriesView(path: string | null): GroceriesView {
  return path?.startsWith("/groceries/pantry") ? "pantry" : "list";
}
