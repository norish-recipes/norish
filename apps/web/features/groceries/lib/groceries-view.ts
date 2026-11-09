export type GroceriesView = "list" | "pantry";

/** Each view's address. */
export const VIEW_HREF: Record<GroceriesView, string> = {
  list: "/groceries",
  pantry: "/groceries/pantry",
};

/** The view an address shows: the root reads it off the address bar, the layout off the request. */
export function groceriesView(path: string | null): GroceriesView {
  return path?.startsWith(VIEW_HREF.pantry) ? "pantry" : "list";
}
