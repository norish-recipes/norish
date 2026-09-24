import { ratings } from "@norish/shared-server/realtime/ratings";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const ratingsSubscriptions = router({
  onRatingUpdated: realtimeSubscription(ratings, "ratingUpdated"),
  onRatingFailed: realtimeSubscription(ratings, "ratingFailed"),
});
