import { useQuery } from "@tanstack/react-query";

import type { PantrySuggestionsResult } from "./types";
import { useConnectivity } from "../offline/react";
import { useTRPC } from "../trpc";

/**
 * "From your recipes": the foods the household's own recipes use that its
 * Pantry does not cover. Best-effort: never asked while Offline, and a failed
 * read is simply no suggestions.
 */
export function usePantrySuggestions(): PantrySuggestionsResult {
  const trpc = useTRPC();
  const { isOffline } = useConnectivity();
  const { data } = useQuery({ ...trpc.pantry.suggestions.queryOptions(), enabled: !isOffline });

  return { suggestions: isOffline ? [] : (data ?? []) };
}
