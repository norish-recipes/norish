import { router } from "../../trpc";

import { ratingsProcedures } from "./ratings";
import { ratingsSubscriptions } from "./subscriptions";

export { ratingsEmitter } from "./emitter";
export type { RatingSubscriptionEvents } from "./types";

export const ratingsRouter = router({
  ...ratingsProcedures._def.procedures,
  ...ratingsSubscriptions._def.procedures,
});
