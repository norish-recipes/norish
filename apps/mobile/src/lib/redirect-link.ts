import { router } from "expo-router";

import { showGroceriesSection } from "./groceries-section";
import { isSheetOpen } from "./tab-bar-visibility";
import { TAB_ROUTES } from "./tab-routes";

/** The time a sheet takes to leave, which the link waits out before it navigates. */
const DISMISS_MS = 400;

// `/groceries/pantry`, as a path or the end of a full link, before any query.
const PANTRY_LINK = /(^|\/)groceries\/pantry\/?([?#].*)?$/;

/** Expo Router asks this of each link before it navigates: one arriving with a sheet open first
 * dismisses the sheet; the Pantry's link opens the Groceries page already on it, with no slide. */
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
  if (!PANTRY_LINK.test(path)) return path;
  showGroceriesSection("pantry");

  return TAB_ROUTES.groceries.root;
}
