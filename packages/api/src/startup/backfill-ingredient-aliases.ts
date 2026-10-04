import type { ResolvedReference } from "@norish/db/repositories/ingredient-backfill";
import type { LegacyKeyedTable } from "@norish/db/repositories/legacy-link-backfill";
import {
  listGroceriesWithoutAlias,
  listPantryIngredientsWithoutAlias,
  listRecipeLinesWithoutAlias,
  listRecurringGroceriesWithoutAlias,
  removeIngredientsWithoutSpelling,
  setGroceryAliases,
  setPantryIngredientAliases,
  setRecipeLineAliases,
  setRecurringGroceryAliases,
} from "@norish/db/repositories/ingredient-backfill";
import {
  dropLegacyRow,
  keyLegacyRow,
  listLegacyKeyedRows,
  listResolvedGroceryNames,
} from "@norish/db/repositories/legacy-link-backfill";
import {
  cleanIngredientText,
  resolveIngredient,
  resolveIngredients,
} from "@norish/shared-server/ingredients/resolver";
import { dbLogger as log } from "@norish/shared-server/logger";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

const BATCH_SIZE = 500;

/** The upgrade resolves an instance's whole history at boot: no model request per row. */
const NO_AI = { ai: false } as const;

/**
 * Carry an instance over to Ingredient Aliases (ADR-0037). It runs at boot
 * after the first seed (ADR-0038), so the catalogue already holds its foods
 * and their spellings, and every reference is resolved from its text as a
 * new import would resolve it with AI off: a recipe line's, a grocery's and a
 * recurring grocery's as written, a Pantry Ingredient's its old ingredient's
 * name. A text the catalogue knows lands on its food ("knoflook
 * (fijngehakt)" is garlic); one it does not is minted flagged, named for its
 * plain name and filed under the food its words name. A `#` heading names no
 * food and is left without an alias.
 *
 * The old `ingredients` rows are no foods of their own: the seed adopted the
 * one whose name is an entry's, and every other one is removed once nothing
 * points at it. Before that, every Product Link, Aisle Link and store
 * preference keyed by a folded name is keyed by the Ingredient the groceries
 * of that name resolved to, or, where no grocery has that name, the
 * Ingredient the name itself resolves to (minted where need be, so no link is
 * dropped). Two that land on one Ingredient at one Store (or for one member)
 * keep the most recently updated.
 *
 * Idempotent by shape: only rows without an alias are listed. A failure
 * leaves the remaining rows for the next startup and never stops the server.
 * With no seed (no URL, or no internet at that boot) the same resolution
 * mints every name flagged, and the first seed merges them later.
 */
export async function backfillIngredientAliases(): Promise<void> {
  const written = {
    recipeLines: 0,
    pantryIngredients: 0,
    groceries: 0,
    recurringGroceries: 0,
    productLinks: 0,
    aisleLinks: 0,
    storePreferences: 0,
    oldIngredientsRemoved: 0,
  };

  try {
    written.recipeLines = await resolveReferences(
      listRecipeLinesWithoutAlias,
      setRecipeLineAliases
    );
    written.pantryIngredients = await resolveReferences(
      listPantryIngredientsWithoutAlias,
      setPantryIngredientAliases
    );
    written.groceries = await resolveReferences(listGroceriesWithoutAlias, setGroceryAliases);
    written.recurringGroceries = await resolveReferences(
      listRecurringGroceriesWithoutAlias,
      setRecurringGroceryAliases
    );

    const groceryIngredients = await groceryIngredientsByFold();

    for (const table of ["productLinks", "aisleLinks", "storePreferences"] as const) {
      written[table] = await keyLegacyRows(table, groceryIngredients);
    }

    written.oldIngredientsRemoved = await removeIngredientsWithoutSpelling();

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
  store: (rows: ResolvedReference[]) => Promise<void>
): Promise<number> {
  let resolvedCount = 0;
  let afterId: string | null = null;

  for (;;) {
    const batch = await list(BATCH_SIZE, afterId);

    if (batch.length === 0) break;

    // Markup alone, punctuation alone or a heading names nothing the resolver could read.
    const named = batch.filter(
      (row) => cleanIngredientText(row.name).length > 0 && !namesNoFood(row.name)
    );

    for (const owner of new Set(named.map((row) => row.userId))) {
      const owned = named.filter((row) => row.userId === owner);
      const resolved = await resolveIngredients(
        owned.map((row) => row.name),
        { userId: owner },
        NO_AI
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

/** The Ingredient each grocery name the household lists resolved to, by its fold. */
async function groceryIngredientsByFold(): Promise<Map<string, string>> {
  const byFold = new Map<string, string>();

  for (const row of await listResolvedGroceryNames()) {
    const fold = ingredientAliasFold(row.name);

    if (!byFold.has(fold)) byFold.set(fold, row.ingredientId);
  }

  return byFold;
}

/** Key every row of one legacy table by its Ingredient, newest first. */
async function keyLegacyRows(
  table: LegacyKeyedTable,
  groceryIngredients: Map<string, string>
): Promise<number> {
  let keyed = 0;

  for (;;) {
    const batch = await listLegacyKeyedRows(table, BATCH_SIZE);

    if (batch.length === 0) break;

    for (const row of batch) {
      const ingredientId =
        groceryIngredients.get(ingredientAliasFold(row.normalizedName)) ??
        (await resolveIngredient(row.normalizedName, { userId: row.ownerId }, NO_AI))?.ingredientId;

      // A name that is markup alone names no food: the link is about nothing.
      if (!ingredientId) await dropLegacyRow(table, row.id);
      else if (await keyLegacyRow(table, row.id, ingredientId)) keyed += 1;
    }
  }

  return keyed;
}
