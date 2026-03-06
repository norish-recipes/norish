import type { CreateHouseholdHooksOptions, HouseholdCacheHelpers, HouseholdQueryResult } from "./types";

export type {
  CreateHouseholdHooksOptions,
  HouseholdCacheHelpers,
  HouseholdData,
  HouseholdMutationsResult,
  HouseholdQueryResult,
} from "./types";

export { createUseHouseholdQuery } from "./use-household-query";
export { createUseHouseholdMutations } from "./use-household-mutations";
export { createUseHouseholdCache } from "./use-household-cache";
export {
  createUseHouseholdSubscription,
  type HouseholdSubscriptionToastAdapter,
} from "./use-household-subscription";

import { createUseHouseholdQuery } from "./use-household-query";
import { createUseHouseholdMutations } from "./use-household-mutations";
import { createUseHouseholdCache } from "./use-household-cache";
import { createUseHouseholdSubscription } from "./use-household-subscription";

type CreateHouseholdHooksFullOptions = CreateHouseholdHooksOptions & {
  useCurrentUserId: () => string | undefined;
  useCurrentUserName: () => string | null;
  useToastAdapter: () => import("./use-household-subscription").HouseholdSubscriptionToastAdapter;
};

export function createHouseholdHooks({
  useTRPC,
  useCurrentUserId,
  useCurrentUserName,
  useToastAdapter,
}: CreateHouseholdHooksFullOptions) {
  const useHouseholdQuery = createUseHouseholdQuery({ useTRPC });
  const useHouseholdCacheHelpers = createUseHouseholdCache({ useTRPC });
  const useHouseholdMutations = createUseHouseholdMutations({
    useTRPC,
    useHouseholdQuery,
    useCurrentUserName,
  });
  const useHouseholdSubscription = createUseHouseholdSubscription({
    useTRPC,
    useHouseholdCacheHelpers,
    useCurrentUserId,
    useToastAdapter,
  });

  return {
    useHouseholdQuery,
    useHouseholdMutations,
    useHouseholdCacheHelpers,
    useHouseholdSubscription,
  };
}
