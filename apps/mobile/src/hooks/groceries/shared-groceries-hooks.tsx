import { sharedConfigHooks } from "@/hooks/config/shared-config-hooks";

import { createGroceriesHooks } from "@norish/shared-react/hooks";
import { usePlatform } from "@norish/shared-react/platform";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedGroceriesHooks = createGroceriesHooks({
  useTRPC,
  useUnitsQuery: sharedConfigHooks.useUnitsQuery,
  useErrorAdapter: () => {
    const { showError } = usePlatform();

    return {
      showErrorToast: (reason: string) => showError(reason, "groceries-subscription:onFailed"),
    };
  },
});

export const useGroceriesQuery = sharedGroceriesHooks.useGroceriesQuery;
export const useGroceriesMutations = sharedGroceriesHooks.useGroceriesMutations;
export const useGroceriesSubscription = sharedGroceriesHooks.useGroceriesSubscription;
