import {
  addOwnNameAliases,
  listIngredientsWithoutAlias,
  listRecipeLinesWithoutAlias,
  setRecipeLineAliases,
} from "@norish/db/repositories/ingredient-aliases";
import {
  ingredientAliasFold,
  resolveIngredients,
} from "@norish/shared-server/ingredients/resolver";
import { dbLogger as log } from "@norish/shared-server/logger";

const BATCH_SIZE = 500;

/**
 * Carry an instance over to Ingredient Aliases (ADR-0037). The fold is the
 * JavaScript grocery folding, so this runs at startup rather than in the SQL
 * migration, after the ingredient-name backfill.
 *
 * Every Ingredient first gets its own name as an alias, oldest first, so
 * where two names fold alike the older Ingredient keeps the spelling. Then
 * every recipe line is resolved from its text as written, which finds those
 * aliases. Idempotent by shape: only rows without an alias are listed. A
 * failure leaves the remaining rows for the next startup and never stops the
 * server.
 */
export async function backfillIngredientAliases(): Promise<void> {
  const written = { ingredients: 0, recipeLines: 0 };

  try {
    let after: { createdAt: string; id: string } | null = null;

    for (;;) {
      const batch = await listIngredientsWithoutAlias(BATCH_SIZE, after);

      if (batch.length === 0) break;

      await addOwnNameAliases(
        batch.map((row) => ({
          ingredientId: row.id,
          text: row.name,
          fold: ingredientAliasFold(row.name),
          ownerId: row.ownerId,
        }))
      );
      written.ingredients += batch.length;

      const last = batch[batch.length - 1]!;

      after = { createdAt: last.createdAt, id: last.id };
    }

    let afterLine: string | null = null;

    for (;;) {
      const batch = await listRecipeLinesWithoutAlias(BATCH_SIZE, afterLine);

      if (batch.length === 0) break;

      const lines = batch.filter((line) => line.name.trim().length > 0);

      for (const owner of new Set(lines.map((line) => line.userId))) {
        const owned = lines.filter((line) => line.userId === owner);
        const resolved = await resolveIngredients(
          owned.map((line) => line.name),
          { userId: owner }
        );

        await setRecipeLineAliases(
          owned.map((line, index) => ({ id: line.id, aliasId: resolved[index]!.aliasId }))
        );
      }
      written.recipeLines += lines.length;
      afterLine = batch[batch.length - 1]!.id;
    }

    if (written.ingredients + written.recipeLines > 0) {
      log.info(written, "Ingredient alias backfill complete");
    }
  } catch (err) {
    log.error({ err, written }, "Ingredient alias backfill could not finish");
  }
}
