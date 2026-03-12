import { createRatingsHooks } from '@norish/shared-react/hooks';

import { useTRPC } from '@/providers/trpc-provider';

const sharedRatingsHooks = createRatingsHooks({ useTRPC });

export const useRatingQuery = sharedRatingsHooks.useRatingQuery;
export const useRatingsMutation = sharedRatingsHooks.useRatingsMutation;
