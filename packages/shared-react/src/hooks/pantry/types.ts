import type { QueryKey } from "@tanstack/react-query";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { PantryIngredientDto, PantrySuggestionDto } from "@norish/shared/contracts";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

export type PantryData = PantryIngredientDto[];

export type PantryQueryResult = {
  items: PantryIngredientDto[];
  error: unknown;
  isLoading: boolean;
  /**
   * The Pantry could not be read and no earlier answer is cached: nothing is
   * known, which an empty `items` alone would misreport as nothing at home.
   */
  isUnavailable: boolean;
  queryKey: QueryKey;
  setPantryData: (updater: (prev: PantryData | undefined) => PantryData | undefined) => void;
  invalidate: () => void;
};

/** A food picked rather than typed: kept as picked, shown by its names until the server answers. */
export type PickedFood = {
  ingredientId: string;
  name: string;
  localeNames?: LocaleNames;
  ancestorIds?: string[];
};

export type PantrySuggestionsResult = {
  suggestions: PantrySuggestionDto[];
};

export type PantryMutationsResult = {
  /** Put a typed name or a picked food in the Pantry; resolves to the item's id. */
  addPantryIngredient: (food: string | PickedFood) => Promise<string>;
  /** Take an item out of the Pantry. */
  removePantryIngredient: (id: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
};

export interface CreatePantryHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
