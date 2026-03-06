import type { CreateRatingsHooksOptions } from "./types";

export type { CreateRatingsHooksOptions } from "./types";

import { createUseRatingQuery } from "./use-ratings-query";
import { createUseRatingsMutation } from "./use-ratings-mutation";
import { createUseRatingsSubscription } from "../recipes/dashboard/use-ratings-subscription";

export { createUseRatingQuery } from "./use-ratings-query";
export { createUseRatingsMutation } from "./use-ratings-mutation";

export function createRatingsHooks({ useTRPC }: CreateRatingsHooksOptions) {
  return {
    useRatingQuery: createUseRatingQuery({ useTRPC }),
    useRatingsMutation: createUseRatingsMutation({ useTRPC }),
    useRatingsSubscription: createUseRatingsSubscription({ useTRPC }),
  };
}
