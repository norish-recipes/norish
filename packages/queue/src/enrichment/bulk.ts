/**
 * Bulk Recipe Enrichment enrollment.
 *
 * One deliberate administrator action that sends every recipe on the server
 * through the same coordinator a newly created recipe goes through — with the
 * automatic origin on purpose, so the enabled automatic switches decide which
 * kinds run and a library-sized sweep never addresses its failures to whoever
 * clicked.
 *
 * By default Supplied Recipe Data keeps winning, so the sweep fills gaps
 * across the library without replacing anything a person or a source already
 * provided. `replaceExisting` is the administrator asking for the opposite:
 * every eligible kind reruns and overwrites what is stored. Categories,
 * Nutrition Information, Recipe Provenance and Step Ingredients are rewritten;
 * tags and allergy indications are appends and are unaffected either way,
 * because nothing records which of them AI wrote.
 */

import { getAllRecipesForEnrichment } from "@norish/db/repositories/recipes";
import { createLogger } from "@norish/shared-server/logger";

import type { RecipeEnrichmentContext } from "./coordinator";
import { enrichRecipe } from "./coordinator";

const log = createLogger("queue:enrichment-bulk");

/** The administrator who asked; the fallback context for ownerless recipes. */
export interface BulkEnrichmentRequester {
  userId: string;
  householdId: string;
}

export interface BulkEnrichmentResult {
  /** How many recipes were evaluated. */
  recipes: number;
  /** How many enrichment runs were actually queued across all kinds. */
  queued: number;
}

export interface BulkEnrichmentOptions {
  /** Overwrite what is stored instead of filling gaps. Defaults to false. */
  replaceExisting?: boolean;
}

export async function enrollEnrichmentForAllRecipes(
  requester: BulkEnrichmentRequester,
  options: BulkEnrichmentOptions = {}
): Promise<BulkEnrichmentResult> {
  const replaceExisting = options.replaceExisting === true;
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
      householdId: target.householdId ?? requester.householdId,
    };

    const results = await enrichRecipe(context, { origin: "automatic", replaceExisting });

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

  log.info(
    { recipes: targets.length, queued, replaceExisting, outcomes },
    "Bulk enrichment enrollment complete"
  );

  return { recipes: targets.length, queued };
}
