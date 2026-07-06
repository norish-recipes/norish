import {
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesSubscription,
} from "@/hooks/groceries";

import { createGroceriesContext } from "@norish/shared-react/contexts";

const sharedGroceriesContext = createGroceriesContext({
  useGroceriesQuery,
  useGroceriesMutations,
  useGroceriesSubscription,
});

export const GroceriesProvider = sharedGroceriesContext.GroceriesProvider;
export const useGroceriesContext = sharedGroceriesContext.useGroceriesContext;
