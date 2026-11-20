import { router } from "expo-router";

import { showGroceriesSection } from "./groceries-section";
import { isSheetOpen } from "./tab-bar-visibility";
import { TAB_ROUTES } from "./tab-routes";

/** The time a sheet takes to leave, which the link waits out before it navigates. */
const DISMISS_MS = 400;

// `/groceries/pantry`, as a path or the end of a full link, before any query.
const PANTRY_LINK = /(^|\/)groceries\/pantry\/?([?#].*)?$/;

// The app path of a link: after a dev server's `/--`, or after the scheme of `norish://recipe/b`.
const APP_PATH = /^(?:.*\/--|[a-z][\w+.-]*:\/)(\/.*)?$/i;

// Today and the recipe and cookbook pages, which Recipes' and Search's stacks share.
const SHARED_PAGE = /^\/+((?:recipe|cookbook)\/[^?#]*)?([?#].*)?$/;

/** A link to a page both stacks hold, pinned to the Recipes tab's: unpinned, it opens in Search's
 * stack while Search is the tab showing. */
function inRecipesTab(path: string): string | null {
  const appPath = APP_PATH.exec(path)?.[1] ?? (path.startsWith("/") ? path : null);
  const shared = appPath === null ? null : SHARED_PAGE.exec(appPath);

  return shared ? `/(recipes)${shared[1] ? `/${shared[1]}` : ""}${shared[2] ?? ""}` : null;
}

/** Expo Router asks this of each outside link: an open sheet is dismissed first, the Pantry's link
 * opens Groceries on the Pantry, and a page Recipes and Search share opens in Recipes. */
export async function redirectLink({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): Promise<string> {
  if (!initial && isSheetOpen()) {
    router.dismissAll();
    await new Promise((resolve) => setTimeout(resolve, DISMISS_MS));
  }
  if (!PANTRY_LINK.test(path)) return inRecipesTab(path) ?? path;
  showGroceriesSection("pantry");

  return TAB_ROUTES.groceries.root;
}
