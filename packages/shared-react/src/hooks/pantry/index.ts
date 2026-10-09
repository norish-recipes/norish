import type { CreatePantryHooksOptions } from "./types";
import { createUsePantryMutations } from "./use-pantry-mutations";
import { createUsePantryQuery } from "./use-pantry-query";
import { createUsePantrySubscription } from "./use-pantry-subscription";
import { createUsePantrySuggestions } from "./use-pantry-suggestions";

export type {
  CreatePantryHooksOptions,
  PantryData,
  PantryMutationsResult,
  PantryQueryResult,
  PantrySuggestionsResult,
  PickedFood,
} from "./types";

export { mergePantryAdded, mergePantryRemoved } from "./merge";
export { createUsePantryQuery } from "./use-pantry-query";
export { createUsePantryMutations } from "./use-pantry-mutations";
export { createUsePantrySubscription } from "./use-pantry-subscription";
export { createUsePantrySuggestions } from "./use-pantry-suggestions";

export function createPantryHooks({ useTRPC }: CreatePantryHooksOptions) {
  const usePantryQuery = createUsePantryQuery({ useTRPC });
  const usePantryMutations = createUsePantryMutations({ useTRPC, usePantryQuery });
  const usePantrySubscription = createUsePantrySubscription({ useTRPC });
  const usePantrySuggestions = createUsePantrySuggestions({ useTRPC });

  return { usePantryQuery, usePantryMutations, usePantrySubscription, usePantrySuggestions };
}
