import type { QueryKey } from "@tanstack/react-query";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

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
