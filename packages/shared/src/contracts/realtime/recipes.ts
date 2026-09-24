/**
 * Recipe realtime catalogue.
 *
 * Everything a recipe announces is routed by the recipe permission policy
 * (`policy`): the reach of the announcement is the reach of the recipe.
 */

import { z } from "zod";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import type { RecipeEnrichmentLifecycleEventDto } from "@norish/shared/lib/recipe-enrichment";
import { RecipeShareLifecycleEventSchema } from "@norish/shared/contracts/zod/recipe-shares";

import { defineRealtimeCatalogue } from "./catalogue";

export const recipeShareEventKinds = [
  "created",
  "updated",
  "revoked",
  "reactivated",
  "deleted",
] as const;

export type RecipeShareEventKind = (typeof recipeShareEventKinds)[number];

export const RecipeShareEventSchema = z.object({
  kind: z.enum(recipeShareEventKinds),
  share: RecipeShareLifecycleEventSchema,
});

export type RecipeShareEvent = z.infer<typeof RecipeShareEventSchema>;

export const recipesRealtime = defineRealtimeCatalogue("recipe", {
  // z.custom: RecipeDashboardDTO has no standalone zod schema yet.
  created: { scope: "policy", payload: z.custom<{ recipe: RecipeDashboardDTO }>() },
  importStarted: { scope: "policy", payload: z.object({ recipeId: z.string(), url: z.string() }) },
  // z.custom: RecipeDashboardDTO has no standalone zod schema yet.
  imported: {
    scope: "policy",
    payload: z.custom<{
      recipe: RecipeDashboardDTO;
      pendingRecipeId?: string;
      toast?: "imported";
    }>(),
  },
  /** One event for every share lifecycle transition; `kind` says which. */
  shareEvent: { scope: "policy", payload: RecipeShareEventSchema },
  // z.custom: FullRecipeDTO has no standalone zod schema yet.
  updated: {
    scope: "policy",
    payload: z.custom<{ recipe: FullRecipeDTO; source?: "enrichment" }>(),
  },
  deleted: { scope: "policy", payload: z.object({ id: z.string() }) },
  // z.custom: FullRecipeDTO has no standalone zod schema yet.
  converted: { scope: "policy", payload: z.custom<{ recipe: FullRecipeDTO }>() },
  failed: {
    scope: "policy",
    payload: z.object({
      reason: z.string(),
      recipeId: z.string().optional(),
      url: z.string().optional(),
    }),
  },
  /**
   * One typed lifecycle event for every Recipe Enrichment kind and transition,
   * so clients need one status implementation rather than four.
   */
  // z.custom: RecipeEnrichmentLifecycleEventDto is guarded by isRecipeEnrichmentLifecycleEvent, not a zod schema.
  enrichment: { scope: "policy", payload: z.custom<RecipeEnrichmentLifecycleEventDto>() },
  // z.custom: RecipeDashboardDTO has no standalone zod schema yet.
  recipeBatchCreated: {
    scope: "household",
    payload: z.custom<{ recipes: RecipeDashboardDTO[] }>(),
  },
});

export type RecipesRealtime = typeof recipesRealtime;
