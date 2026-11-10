import type { CreateRatingsHooksOptions } from "./types";
import { useRatingQuery, useRatingsMutation, useRatingsSubscription } from "../../recipes";

export type { CreateRatingsHooksOptions } from "./types";

export function createRatingsHooks(_options: CreateRatingsHooksOptions) {
  return { useRatingQuery, useRatingsMutation, useRatingsSubscription };
}
