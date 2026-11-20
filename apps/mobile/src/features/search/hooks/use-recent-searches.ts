import { useSyncExternalStore } from "react";

import {
  clearRecentSearches,
  getRecentSearches,
  subscribeRecentSearches,
} from "../utils/recent-searches-store";

/** This account's Recent Searches on this device, newest first. */
export function useRecentSearches() {
  const recents = useSyncExternalStore(subscribeRecentSearches, getRecentSearches);

  return { recents, clear: clearRecentSearches };
}
