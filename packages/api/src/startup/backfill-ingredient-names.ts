import {
  listIngredientNamesMissingNormalizedName,
  setIngredientNormalizedNames,
} from "@norish/db/repositories/ingredients";
import { dbLogger as log } from "@norish/shared-server/logger";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

const BATCH_SIZE = 500;

/**
 * Fold the Ingredient Names stored before names were folded, so the Pantry can
 * match them (ADR-0032). New names are folded when they are written; only this
 * pass ever reads old ones.
 *
 * The folding is the JavaScript grocery folding rather than a SQL
 * approximation, so a name folded here and a name folded in a browser always
 * agree. Idempotent by shape: only rows with no folded form are listed. A
 * failure leaves the remaining rows for the next startup and never stops the
 * server.
 */
export async function backfillIngredientNormalizedNames(): Promise<void> {
  let written = 0;

  try {
    for (;;) {
      const batch = await listIngredientNamesMissingNormalizedName(BATCH_SIZE);

      if (batch.length === 0) break;

      await setIngredientNormalizedNames(
        batch.map((row) => ({ id: row.id, normalizedName: normalizeGroceryName(row.name) }))
      );
      written += batch.length;

      if (batch.length < BATCH_SIZE) break;
    }

    if (written > 0) log.info({ written }, "Ingredient name backfill complete");
  } catch (err) {
    log.error({ err, written }, "Ingredient name backfill could not finish");
  }
}
