import { clearRecentSearches, useRecentSearchList } from "../utils/recent-searches-store";

/** This account's Recent Searches on this device, newest first. */
export function useRecentSearches() {
  const recents = useRecentSearchList();

  return { recents, clear: clearRecentSearches };
}
