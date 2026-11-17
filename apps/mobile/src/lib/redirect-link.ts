import { router } from "expo-router";

import { isSheetOpen } from "./tab-bar-visibility";

/** The time a sheet takes to leave, which the link waits out before it navigates. */
const DISMISS_MS = 400;

/** Expo Router asks this of each link before it navigates: one arriving with a sheet open first
 * dismisses the sheet, so the page it names is not shown inside it. */
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

  return path;
}
