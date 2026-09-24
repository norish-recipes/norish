/**
 * Cookbook realtime catalogue.
 *
 * Cookbooks answer to the recipe permission policy (ADR-0027), so every
 * event is routed by `policy`. There is no echo suppression: a cookbook's
 * viewer-scoped member count and derived cover are computed server-side, so
 * the actor wants its own echo too.
 */

import { z } from "zod";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import { defineRealtimeCatalogue } from "./catalogue";

export const cookbooksRealtime = defineRealtimeCatalogue("cookbook", {
  // z.custom: CookbookSummaryDTO's schema carries derived fields; kept opaque for now.
  created: { scope: "policy", payload: z.custom<{ cookbook: CookbookSummaryDTO }>() },
  // z.custom: CookbookSummaryDTO's schema carries derived fields; kept opaque for now.
  updated: { scope: "policy", payload: z.custom<{ cookbook: CookbookSummaryDTO }>() },
  deleted: { scope: "policy", payload: z.object({ id: z.string() }) },
  /** A recipe was filed into, or taken out of, a cookbook. */
  membershipChanged: {
    scope: "policy",
    payload: z.object({ cookbookId: z.string(), recipeId: z.string(), isMember: z.boolean() }),
  },
});

export type CookbooksRealtime = typeof cookbooksRealtime;
