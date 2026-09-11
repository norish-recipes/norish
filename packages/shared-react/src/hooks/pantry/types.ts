import type { QueryKey } from "@tanstack/react-query";

import type { PantryIngredientDto } from "@norish/shared/contracts";

import type { TrpcHookBinding } from "../stores/types";

export type PantryData = PantryIngredientDto[];

export type PantryQueryResult = {
  items: PantryIngredientDto[];
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setPantryData: (updater: (prev: PantryData | undefined) => PantryData | undefined) => void;
  invalidate: () => void;
};

export type PantryMutationsResult = {
  /** Put a name in the Pantry; resolves to the item's id. */
  addPantryIngredient: (name: string) => Promise<string>;
  /** Take an item out of the Pantry. */
  removePantryIngredient: (id: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
};

export interface CreatePantryHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
