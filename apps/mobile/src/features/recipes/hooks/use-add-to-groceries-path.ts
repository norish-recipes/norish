import { usePathname } from "expo-router";

/** Add to groceries opens over the tab it was asked from: the Calendar's stack has its own. */
export function useAddToGroceriesPath() {
  return usePathname().startsWith("/calendar") ? "/calendar/add-to-groceries" : "/add-to-groceries";
}
