import type { CreateCaldavHooksOptions } from "./types";

export type {
  CreateCaldavHooksOptions,
  CaldavCacheHelpers,
  CaldavConfigQueryResult,
  CaldavMutationsResult,
  CaldavSummaryQueryResult,
  CaldavSyncStatusQueryResult,
  SaveCaldavConfigInput,
  TestConnectionInput,
  FetchCalendarsInput,
} from "./types";

export { createUseCaldavQuery } from "./use-caldav-query";
export { createUseCaldavMutations } from "./use-caldav-mutations";
export { createUseCaldavCache } from "./use-caldav-cache";
export { createUseCaldavSubscription, type CaldavSubscriptionToastAdapter } from "./use-caldav-subscription";

import { createUseCaldavQuery } from "./use-caldav-query";
import { createUseCaldavMutations } from "./use-caldav-mutations";
import { createUseCaldavCache } from "./use-caldav-cache";
import { createUseCaldavSubscription } from "./use-caldav-subscription";

import type { CaldavSubscriptionToastAdapter } from "./use-caldav-subscription";

type CreateCaldavHooksFullOptions = CreateCaldavHooksOptions & {
  useToastAdapter: () => CaldavSubscriptionToastAdapter;
};

export function createCaldavHooks({ useTRPC, useToastAdapter }: CreateCaldavHooksFullOptions) {
  const queries = createUseCaldavQuery({ useTRPC });
  const useCaldavCacheHelpers = createUseCaldavCache({ useTRPC });
  const useCaldavMutations = createUseCaldavMutations({
    useTRPC,
    useCaldavConfigQuery: queries.useCaldavConfigQuery,
    useCaldavSyncStatusQuery: queries.useCaldavSyncStatusQuery,
    useCaldavSummaryQuery: queries.useCaldavSummaryQuery,
  });
  const subscriptions = createUseCaldavSubscription({
    useTRPC,
    useCaldavCacheHelpers,
    useToastAdapter,
  });

  return {
    ...queries,
    useCaldavCacheHelpers,
    useCaldavMutations,
    ...subscriptions,
  };
}
