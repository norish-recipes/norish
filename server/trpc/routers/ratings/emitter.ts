import type { RatingSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

declare global {
  var __ratingsEmitter__: TypedEmitter<RatingSubscriptionEvents> | undefined;
}

export const ratingsEmitter =
  globalThis.__ratingsEmitter__ ||
  (globalThis.__ratingsEmitter__ = createTypedEmitter<RatingSubscriptionEvents>("rating"));
