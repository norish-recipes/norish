"use client";

import { sharedRatingsHooks } from "./shared-ratings-hooks";

export const useRatingQuery = sharedRatingsHooks.useRatingQuery;
export const useRatingsMutation = sharedRatingsHooks.useRatingsMutation;

// Subscription is kept as the existing web-specific wrapper (uses toast/i18n adapters)
export { useRatingsSubscription } from "./use-ratings-subscription";
