import { useQuery } from "@tanstack/react-query";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { uncoveredSuggestions } from "@norish/shared/lib/pantry";

import type { PantrySuggestionsResult } from "./types";
import { useSpellingRules } from "../config";
import { useConnectivity } from "../offline/react";
import { useTRPC } from "../trpc";

/**
 * "From your recipes": the foods the household's own recipes use that `items`,
 * its Pantry, does not cover, by the rule the server suggested them by.
 * Best-effort: never asked while Offline, and a failed read is simply no suggestions.
 */
export function usePantrySuggestions(
  items: readonly PantryIngredientDto[]
): PantrySuggestionsResult {
  const trpc = useTRPC();
  const rules = useSpellingRules();
  const { isOffline } = useConnectivity();
  const { data } = useQuery({ ...trpc.pantry.suggestions.queryOptions(), enabled: !isOffline });

  return { suggestions: isOffline ? [] : uncoveredSuggestions(items, data ?? [], rules) };
}
