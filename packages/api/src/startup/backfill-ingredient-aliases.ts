import type {
  LegacyKeyedTable,
  ResolvedReference,
} from "@norish/db/repositories/ingredient-backfill";
import { findIngredientAliasesByFolds } from "@norish/db/repositories/ingredient-aliases";
import {
  addOwnNameAliases,
  dropLegacyRow,
  keyLegacyRow,
  listGroceriesWithoutAlias,
  listIngredientsWithoutAlias,
  listLegacyKeyedRows,
  listPantryIngredientsWithoutAlias,
  listRecipeLinesWithoutAlias,
  listRecurringGroceriesWithoutAlias,
  listResolvedGroceryNames,
  setGroceryAliases,
  setPantryIngredientAliases,
  setRecipeLineAliases,
  setRecurringGroceryAliases,
} from "@norish/db/repositories/ingredient-backfill";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-catalogue";
import {
  cleanIngredientText,
  ingredientAliasFold,
  resolveIngredient,
  resolveIngredients,
} from "@norish/shared-server/ingredients/resolver";
import { dbLogger as log } from "@norish/shared-server/logger";

const BATCH_SIZE = 500;

/** The upgrade resolves an instance's whole history at boot: no model request per row. */
const NO_AI = { ai: false } as const;

/**
 * Carry an instance over to Ingredient Aliases (ADR-0037). The fold is the
 * JavaScript grocery folding, so this runs at startup rather than in the SQL
 * migration, after the ingredient-name backfill.
 *
 * Every Ingredient first gets its own name as an alias, oldest first, so
 * where two names fold alike the older Ingredient keeps the spelling and the
 * newer one, left with no spelling of its own, is merged into it. Then
 * every reference is resolved from its text — a recipe line's, a grocery's and
 * a recurring grocery's as written, a Pantry Ingredient's its Ingredient's
 * name — which finds those aliases. Last, every Product Link, Aisle Link and
 * store preference keyed by a folded name is keyed by the Ingredient the
 * groceries of that name resolved to, or, where no grocery has that name, the
 * Ingredient the name itself resolves to (minted where need be, so no link is
 * dropped). Two that land on one Ingredient at one Store (or for one member)
 * keep the most recently updated.
 *
 * Idempotent by shape: only rows without an alias are listed. A failure
 * leaves the remaining rows for the next startup and never stops the server.
 *
 * This is the upgrade and nothing more: it merges only names that fold alike,
 * a name nothing knows is minted flagged, and a row that has an alias is never
 * visited again. Merging existing Ingredients into the catalogue seed is the
 * seed's own pass, once a seed exists.
 */
export async function backfillIngredientAliases(): Promise<void> {
  const written = {
    ingredients: 0,
    merged: 0,
    recipeLines: 0,
    pantryIngredients: 0,
    groceries: 0,
    recurringGroceries: 0,
    productLinks: 0,
    aisleLinks: 0,
    storePreferences: 0,
  };

  try {
    let after: { createdAt: string; id: string } | null = null;

    for (;;) {
      const batch = await listIngredientsWithoutAlias(BATCH_SIZE, after);

      if (batch.length === 0) break;

      const ownNames = batch.map((row) => ({
        ingredientId: row.id,
        text: row.name,
        fold: ingredientAliasFold(row.name),
        ownerId: row.ownerId,
      }));

      await addOwnNameAliases(ownNames);
      written.ingredients += batch.length;
      written.merged += await mergeSpellingless(ownNames);

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
    written.groceries = await resolveReferences(listGroceriesWithoutAlias, setGroceryAliases);
    written.recurringGroceries = await resolveReferences(
      listRecurringGroceriesWithoutAlias,
      setRecurringGroceryAliases
    );

    const groceryIngredients = await groceryIngredientsByFold();

    for (const table of ["productLinks", "aisleLinks", "storePreferences"] as const) {
      written[table] = await keyLegacyRows(table, groceryIngredients);
    }

    if (Object.values(written).some((count) => count > 0)) {
      log.info(written, "Ingredient alias backfill complete");
    }
  } catch (err) {
    log.error({ err, written }, "Ingredient alias backfill could not finish");
  }
}

/**
 * Merge each Ingredient whose own name another Ingredient already held into
 * that one: the names fold alike, so they are one food, and an Ingredient no
 * spelling reaches would sit on the Ingredients page with nothing to show.
 */
async function mergeSpellingless(
  ownNames: ReadonlyArray<{ ingredientId: string; fold: string }>
): Promise<number> {
  const holders = new Map(
    (await findIngredientAliasesByFolds(ownNames.map((row) => row.fold))).map((alias) => [
      alias.fold,
      alias.ingredientId,
    ])
  );
  let merged = 0;

  for (const { ingredientId, fold } of ownNames) {
    const holder = holders.get(fold);

    if (holder && holder !== ingredientId) {
      await mergeCatalogueIngredients(ingredientId, holder);
      merged += 1;
    }
  }

  return merged;
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

    // Text that is markup alone names nothing the resolver could read.
    const named = batch.filter((row) => cleanIngredientText(row.name).length > 0);

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
