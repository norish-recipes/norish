import type { QueryKey } from "@tanstack/react-query";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

export type RecipeInfo = {
  recipeId: string;
  recipeName: string;
};

export type RecipeMap = Record<string, RecipeInfo>;

export type GroceriesData = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
};

export type GroceriesQueryResult = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setGroceriesData: (
    updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
  ) => void;
  invalidate: () => void;
  getRecipeNameForGrocery: (grocery: GroceryDto) => string | null;
};

export type GroceriesCacheHelpers = {
  setGroceriesData: (
    updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
  ) => void;
  invalidate: () => void;
};

export type GroceryCreateData = {
  name: string;
  amount?: number | null;
  unit?: string | null;
  isDone?: boolean;
  recipeIngredientId?: string | null;
};

export type GroceriesMutationsResult = {
  createGrocery: (raw: string, storeId?: string | null) => void;
  createGroceriesFromData: (groceries: GroceryCreateData[]) => Promise<string[]>;
  createRecurringGrocery: (
    raw: string,
    pattern: RecurrencePattern,
    storeId?: string | null
  ) => void;
  toggleGroceries: (ids: string[], isDone: boolean) => void;
  toggleRecurringGrocery: (recurringGroceryId: string, groceryId: string, isDone: boolean) => void;
  updateGrocery: (id: string, raw: string) => void;
  updateRecurringGrocery: (
    recurringGroceryId: string,
    groceryId: string,
    raw: string,
    pattern: RecurrencePattern | null
  ) => void;
  deleteGroceries: (ids: string[]) => void;
  deleteRecurringGrocery: (recurringGroceryId: string) => void;
  getRecurringGroceryForGrocery: (groceryId: string) => RecurringGroceryDto | null;
  assignGroceryToStore: (
    groceryId: string,
    storeId: string | null,
    savePreference?: boolean
  ) => void;
  reorderGroceriesInStore: (
    updates: { id: string; sortOrder: number; storeId?: string | null }[]
  ) => void;
  markAllDoneInStore: (storeId: string | null) => void;
  deleteDoneInStore: (storeId: string | null) => void;
};

export interface CreateGroceriesHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
