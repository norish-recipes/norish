import type { CreateGroceriesHooksOptions, GroceriesCacheHelpers, GroceriesQueryResult } from "./types";

export type {
  CreateGroceriesHooksOptions,
  GroceriesCacheHelpers,
  GroceriesData,
  GroceriesMutationsResult,
  GroceriesQueryResult,
  GroceryCreateData,
  RecipeInfo,
  RecipeMap,
} from "./types";

export { createUseGroceriesQuery } from "./use-groceries-query";
export { createUseGroceriesMutations } from "./use-groceries-mutations";
export { createUseGroceriesCache } from "./use-groceries-cache";
export {
  createUseGroceriesSubscription,
  type GroceriesSubscriptionErrorAdapter,
} from "./use-groceries-subscription";

import { createUseGroceriesQuery } from "./use-groceries-query";
import { createUseGroceriesMutations } from "./use-groceries-mutations";
import { createUseGroceriesCache } from "./use-groceries-cache";
import { createUseGroceriesSubscription } from "./use-groceries-subscription";

import type { UnitsMap } from "@norish/config/zod/server-config";

type CreateGroceriesHooksFullOptions = CreateGroceriesHooksOptions & {
  useUnitsQuery: () => { units: UnitsMap };
  useErrorAdapter: () => import("./use-groceries-subscription").GroceriesSubscriptionErrorAdapter;
};

export function createGroceriesHooks({
  useTRPC,
  useUnitsQuery,
  useErrorAdapter,
}: CreateGroceriesHooksFullOptions) {
  const useGroceriesQuery = createUseGroceriesQuery({ useTRPC });
  const useGroceriesCacheHelpers = createUseGroceriesCache({ useTRPC });
  const useGroceriesMutations = createUseGroceriesMutations({
    useTRPC,
    useGroceriesQuery,
    useUnitsQuery,
  });
  const useGroceriesSubscription = createUseGroceriesSubscription({
    useTRPC,
    useGroceriesCacheHelpers,
    useErrorAdapter,
  });

  return {
    useGroceriesQuery,
    useGroceriesMutations,
    useGroceriesCacheHelpers,
    useGroceriesSubscription,
  };
}
