import { useQuery } from "@tanstack/react-query";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { uncoveredSuggestions } from "@norish/shared/lib/pantry";

import type { PantrySuggestionsResult } from "./types";
import { useSpellingRules } from "../config";
import { useConnectivity } from "../offline/react";
import { useTRPC } from "../trpc";

/** "From your recipes": foods the household's recipes use that `items`, its Pantry, does not cover
 * by the server's rule. Best-effort: not asked Offline, and a failed read is no suggestions. */
export function usePantrySuggestions(
  items: readonly PantryIngredientDto[]
): PantrySuggestionsResult {
  const trpc = useTRPC();
  const rules = useSpellingRules();
  const { isOffline } = useConnectivity();
  const { data } = useQuery({ ...trpc.pantry.suggestions.queryOptions(), enabled: !isOffline });

  return { suggestions: isOffline ? [] : uncoveredSuggestions(items, data ?? [], rules) };
}
