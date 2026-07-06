import { createEnvelopeAwareSubscription } from "../../helpers";
import { router } from "../../trpc";
import { ratingsEmitter } from "./emitter";

const onRatingUpdated = createEnvelopeAwareSubscription(
  ratingsEmitter,
  "ratingUpdated",
  "rating updates"
);
const onRatingFailed = createEnvelopeAwareSubscription(
  ratingsEmitter,
  "ratingFailed",
  "rating failures"
);

export const ratingsSubscriptions = router({
  onRatingUpdated,
  onRatingFailed,
});
