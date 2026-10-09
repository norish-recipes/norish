import { useQuery } from "@tanstack/react-query";

import type { CreatePantryHooksOptions, PantrySuggestionsResult } from "./types";

/**
 * "From your recipes": the foods the household's own recipes use that its
 * Pantry does not cover. Best-effort: `enabled` is false where it cannot be
 * asked (offline), and a failed read is simply no suggestions.
 */
export function createUsePantrySuggestions({ useTRPC }: CreatePantryHooksOptions) {
  return function usePantrySuggestions(enabled = true): PantrySuggestionsResult {
    const trpc = useTRPC();
    const { data } = useQuery({ ...trpc.pantry.suggestions.queryOptions(), enabled });

    return { suggestions: enabled ? (data ?? []) : [] };
  };
}
