import { router } from "../../trpc";
import { createPolicyAwareSubscription } from "../../helpers";

import { ratingsEmitter } from "./emitter";

const onRatingUpdated = createPolicyAwareSubscription(ratingsEmitter, "ratingUpdated", "rating updates");
const onRatingFailed = createPolicyAwareSubscription(ratingsEmitter, "ratingFailed", "rating failures");

export const ratingsSubscriptions = router({
  onRatingUpdated,
  onRatingFailed,
});
