/**
 * Rating realtime catalogue. Routed by the recipe permission policy.
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
  ratingFailed: {
    scope: "policy",
    payload: z.object({ recipeId: z.string(), reason: z.string() }),
  },
});

export type RatingsRealtime = typeof ratingsRealtime;
