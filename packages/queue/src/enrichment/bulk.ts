/**
 * Bulk Recipe Enrichment enrollment.
 *
 * One deliberate administrator action that sends every recipe on the server
 * through the same coordinator a newly created recipe goes through — with the
 * automatic origin on purpose. The enabled automatic switches decide which
 * kinds run, and Supplied Recipe Data keeps winning, so the sweep fills gaps
 * across the library without replacing anything a person or a source already
 * provided, and without running kinds the administrator has turned off.
 */

import { getAllRecipesForEnrichment } from "@norish/db/repositories/recipes";
import { createLogger } from "@norish/shared-server/logger";

import type { RecipeEnrichmentContext } from "./coordinator";
import { enrichRecipe } from "./coordinator";

const log = createLogger("queue:enrichment-bulk");

/** The administrator who asked; the fallback context for ownerless recipes. */
export interface BulkEnrichmentRequester {
  userId: string;
  householdKey: string;
}

export interface BulkEnrichmentResult {
  /** How many recipes were evaluated. */
  recipes: number;
  /** How many enrichment runs were actually queued across all kinds. */
  queued: number;
}

export async function enrollEnrichmentForAllRecipes(
  requester: BulkEnrichmentRequester
): Promise<BulkEnrichmentResult> {
  const targets = await getAllRecipesForEnrichment();
  const outcomes: Record<string, number> = {};
  let queued = 0;

  for (const target of targets) {
    // A recipe whose owner was deleted falls back to the requesting
    // administrator's context: lifecycle events still reach a household, and
    // allergy detection resolves against the administrator's.
    const context: RecipeEnrichmentContext = {
      recipeId: target.recipeId,
      userId: target.userId ?? requester.userId,
      householdKey: target.householdId ?? requester.householdKey,
      householdUserIds: null,
    };

    const results = await enrichRecipe(context, { origin: "automatic" });

    queued += results.filter((result) => result.status === "queued").length;

    for (const result of results) {
      // Aggregated, not per recipe: a library-sized sweep still logs one line,
      // but an administrator asking "why did nothing run?" gets the reasons.
      const outcome =
        result.status === "skipped"
          ? `${result.kind}:${result.reason}`
          : `${result.kind}:${result.status}`;

      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    }
  }

  log.info({ recipes: targets.length, queued, outcomes }, "Bulk enrichment enrollment complete");

  return { recipes: targets.length, queued };
}
