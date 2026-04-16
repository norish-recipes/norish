import { useTRPC } from "@/providers/trpc-provider";

import { createRatingsHooks } from "@norish/shared-react/hooks";

const sharedRatingsHooks = createRatingsHooks({ useTRPC });

export const useRatingQuery = sharedRatingsHooks.useRatingQuery;
export const useRatingsMutation = sharedRatingsHooks.useRatingsMutation;
