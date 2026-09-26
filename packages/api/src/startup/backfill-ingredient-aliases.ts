import {
  addOwnNameAliases,
  listIngredientsWithoutAlias,
  listPantryIngredientsWithoutAlias,
  listRecipeLinesWithoutAlias,
  setPantryIngredientAliases,
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
 * every reference is resolved from its text — a recipe line's as written, a
 * Pantry Ingredient's its Ingredient's name — which finds those aliases. Idempotent by shape: only rows without an alias are listed. A
 * failure leaves the remaining rows for the next startup and never stops the
 * server.
 */
export async function backfillIngredientAliases(): Promise<void> {
  const written = { ingredients: 0, recipeLines: 0, pantryIngredients: 0 };

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

    written.recipeLines = await resolveReferences(
      listRecipeLinesWithoutAlias,
      setRecipeLineAliases
    );
    written.pantryIngredients = await resolveReferences(
      listPantryIngredientsWithoutAlias,
      setPantryIngredientAliases
    );

    if (Object.values(written).some((count) => count > 0)) {
      log.info(written, "Ingredient alias backfill complete");
    }
  } catch (err) {
    log.error({ err, written }, "Ingredient alias backfill could not finish");
  }
}

type Reference = { id: string; name: string; userId: string | null };

/**
 * Resolve every reference a listing yields, batch by batch, as the member it
 * belongs to, and store the answers. A reference with no text has nothing to
 * resolve and is passed over.
 */
async function resolveReferences(
  list: (limit: number, afterId: string | null) => Promise<Reference[]>,
  store: (rows: Array<{ id: string; aliasId: string; ingredientId: string }>) => Promise<void>
): Promise<number> {
  let resolvedCount = 0;
  let afterId: string | null = null;

  for (;;) {
    const batch = await list(BATCH_SIZE, afterId);

    if (batch.length === 0) break;

    const named = batch.filter((row) => row.name.trim().length > 0);

    for (const owner of new Set(named.map((row) => row.userId))) {
      const owned = named.filter((row) => row.userId === owner);
      const resolved = await resolveIngredients(
        owned.map((row) => row.name),
        { userId: owner }
      );

      await store(
        owned.map((row, index) => ({
          id: row.id,
          aliasId: resolved[index]!.aliasId,
          ingredientId: resolved[index]!.ingredientId,
        }))
      );
    }
    resolvedCount += named.length;
    afterId = batch[batch.length - 1]!.id;
  }

  return resolvedCount;
}
