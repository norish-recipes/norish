/**
 * Rating realtime catalogue. Updates are routed by the recipe permission policy.
 */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

export const ratingsRealtime = defineRealtimeCatalogue("rating", {
  ratingUpdated: {
    scope: "policy",
    payload: z.object({
      recipeId: z.string(),
      averageRating: z.number().nullable(),
      ratingCount: z.number(),
    }),
  },
  // A failed rating is the rater's own news.
  ratingFailed: {
    scope: "user",
    payload: z.object({ recipeId: z.string(), reason: z.string() }),
  },
});

export type RatingsRealtime = typeof ratingsRealtime;
