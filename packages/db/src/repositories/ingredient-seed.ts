import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import type { NutritionCodes } from "@norish/db/schema";
import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  ingredientAliases,
  ingredientNutritionCorrections,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  recipeIngredients,
  recurringGroceries,
  storeProductLinks,
} from "@norish/db/schema";

import { findIngredientAncestors, lockTree } from "./ingredient-relocation";

/**
 * The catalogue seed's writes (ADR-0038). Applying the seed upserts seeded
 * Ingredients, their seeded aliases and their seeded parents, and nothing a
 * person made: an owned alias, a merge, an alias move and a parent a person
 * set all outlive every refresh. The one pass that merges existing Ingredients
 * into the seed reads through here and merges through the catalogue.
 */

/** One taxonomy entry as the seed applies it, its spellings already folded. */
export interface SeedEntry {
  offId: string;
  name: string;
  /** The fold of the name: an Ingredient already holding it is this entry. */
  nameFold: string;
  parentOffId: string | null;
  aliases: ReadonlyArray<{ text: string; fold: string; locale: string | null }>;
  /** What the entry says about its nutrition (ADR-0039), or null. */
  nutrition: NutritionCodes | null;
}

export interface SeedOutcome {
  /** New Ingredients the seed minted. */
  created: number;
  /** Existing Ingredients found to be an entry, which now carry its id. */
  adopted: number;
  /** Entries whose name another entry's Ingredient already holds (merged there by a person). */
  absorbed: number;
  aliasesAdded: number;
  /**
   * Seeded spellings another Ingredient already holds, or an earlier entry of
   * the same file claims, which stay where they are.
   */
  aliasCollisions: Array<{ fold: string; offId: string }>;
  parentsSet: number;
  /** Seeded parents not set because they would have closed a cycle with a person's tree. */
  parentCycles: number;
  /** Ingredients the file no longer lists and nothing used, removed. */
  removed: number;
  /** Seeded Ingredients whose nutrition codes the file changed. */
  nutritionChanged: number;
}

/**
 * Codes as compared: one spelling for the same codes, whatever order the
 * stored jsonb gives its keys back in, so an unchanged file writes nothing.
 */
function codesKey(codes: NutritionCodes | null | undefined): string {
  return codes
    ? JSON.stringify([
        codes.ciqual,
        codes.usda,
        codes.ciqualOther,
        codes.pieceWeight,
        codes.density,
      ])
    : "null";
}

/** How many rows one insert or lookup carries: well under Postgres's parameter limit. */
const CHUNK = 1000;

function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];

  for (let start = 0; start < items.length; start += CHUNK) {
    out.push(items.slice(start, start + CHUNK));
  }

  return out;
}

/** The Ingredient each fold names, for the folds asked about. */
async function holdersOf(
  tx: DbTransaction,
  folds: readonly string[]
): Promise<Map<string, string>> {
  const held = new Map<string, string>();

  for (const part of chunks([...new Set(folds)])) {
    const rows = await tx
      .select({ fold: ingredientAliases.fold, ingredientId: ingredientAliases.ingredientId })
      .from(ingredientAliases)
      .where(inArray(ingredientAliases.fold, part));

    for (const row of rows) held.set(row.fold, row.ingredientId);
  }

  return held;
}

/** Whether giving `id` the parent `parentId` would make it its own ancestor. */
function closesCycle(parents: ReadonlyMap<string, string | null>, id: string, parentId: string) {
  let current: string | null | undefined = parentId;

  for (let depth = 0; current && depth < 64; depth += 1) {
    if (current === id) return true;
    current = parents.get(current);
  }

  return false;
}

/**
 * Apply a parsed, validated seed in one transaction, so a failure leaves the
 * last good seed exactly as it was.
 *
 * - An entry's Ingredient is the one that already carries its id; else the
 *   one that holds its name as a spelling or as a name, which is adopted
 *   (given the id) when it carries no other; else a new, ownerless one.
 *   One that carries another entry's id absorbed this entry in a merge, and
 *   the entry is left there.
 * - Every spelling of every entry is added as a seeded alias; a spelling
 *   another Ingredient already holds stays where it is, and is reported.
 * - An entry's first parent becomes its Ingredient's parent, unless a person
 *   set or cleared that Ingredient's parent, or the parent would close a
 *   cycle. An entry with no parent leaves its Ingredient's parent alone.
 * - A seeded Ingredient the file no longer lists is removed only when nothing
 *   uses it: no line, grocery, recurring grocery or Pantry Ingredient
 *   through any of its spellings, no link, preference or nutrition
 *   correction, no spelling a person added, and no child.
 */
export async function applyIngredientSeed(entries: readonly SeedEntry[]): Promise<SeedOutcome> {
  return await db.transaction(async (tx) => {
    await lockTree(tx);

    const outcome: SeedOutcome = {
      created: 0,
      adopted: 0,
      absorbed: 0,
      aliasesAdded: 0,
      aliasCollisions: [],
      parentsSet: 0,
      parentCycles: 0,
      removed: 0,
      nutritionChanged: 0,
    };
    const existing = await tx
      .select({
        id: ingredients.id,
        name: ingredients.name,
        offId: ingredients.offId,
        parentId: ingredients.parentId,
        parentChosen: ingredients.parentChosen,
        nutritionCodes: ingredients.nutritionCodes,
      })
      .from(ingredients);
    const byId = new Map(existing.map((row) => [row.id, row]));
    const byOffId = new Map(existing.flatMap((row) => (row.offId ? [[row.offId, row.id]] : [])));
    const byName = new Map(existing.map((row) => [row.name.toLowerCase(), row.id]));
    const nameHolders = await holdersOf(
      tx,
      entries.map((entry) => entry.nameFold)
    );

    // Which Ingredient each entry is.
    const ingredientOf = new Map<string, string>();
    const adopted = new Set<string>();
    const toCreate: SeedEntry[] = [];

    for (const entry of entries) {
      const known = byOffId.get(entry.offId);

      if (known) {
        ingredientOf.set(entry.offId, known);
        continue;
      }

      const holder = nameHolders.get(entry.nameFold) ?? byName.get(entry.name.toLowerCase());
      const row = holder ? byId.get(holder) : undefined;

      if (!row) {
        toCreate.push(entry);
      } else if (row.offId === null && !adopted.has(row.id)) {
        adopted.add(row.id);
        ingredientOf.set(entry.offId, row.id);
        await tx.update(ingredients).set({ offId: entry.offId }).where(eq(ingredients.id, row.id));
        outcome.adopted += 1;
      } else {
        outcome.absorbed += 1;
      }
    }

    for (const part of chunks(toCreate)) {
      const created = await tx
        .insert(ingredients)
        .values(
          part.map((entry) => ({
            name: entry.name,
            offId: entry.offId,
            nutritionCodes: entry.nutrition,
          }))
        )
        .onConflictDoNothing()
        .returning({ id: ingredients.id, offId: ingredients.offId });

      const codesOf = new Map(part.map((entry) => [entry.offId, entry.nutrition]));

      for (const row of created) {
        ingredientOf.set(row.offId!, row.id);
        byId.set(row.id, {
          ...row,
          name: "",
          parentId: null,
          parentChosen: false,
          nutritionCodes: codesOf.get(row.offId!) ?? null,
        });
      }
      outcome.created += created.length;
      // An entry whose name an Ingredient took meanwhile is picked up next time.
    }

    // Every spelling, first claim first.
    const wanted = new Map<string, { offId: string; row: typeof ingredientAliases.$inferInsert }>();

    for (const entry of entries) {
      const ingredientId = ingredientOf.get(entry.offId);

      if (!ingredientId) continue;
      for (const alias of entry.aliases) {
        const claimed = wanted.get(alias.fold);

        if (claimed) {
          // Two entries share the spelling: the first one keeps it.
          if (claimed.offId !== entry.offId) {
            outcome.aliasCollisions.push({ fold: alias.fold, offId: entry.offId });
          }
          continue;
        }
        wanted.set(alias.fold, {
          offId: entry.offId,
          row: { ...alias, ingredientId, ownerId: null, seeded: true },
        });
      }
    }

    const added = new Set<string>();

    for (const part of chunks([...wanted.values()])) {
      const rows = await tx
        .insert(ingredientAliases)
        .values(part.map(({ row }) => row))
        .onConflictDoNothing()
        .returning({ fold: ingredientAliases.fold });

      for (const row of rows) added.add(row.fold);
    }
    outcome.aliasesAdded = added.size;

    const notAdded = [...wanted.keys()].filter((fold) => !added.has(fold));
    const holders = await holdersOf(tx, notAdded);

    for (const fold of notAdded) {
      const claim = wanted.get(fold)!;

      if (holders.get(fold) !== claim.row.ingredientId) {
        outcome.aliasCollisions.push({ fold, offId: claim.offId });
      }
    }

    // Parents, where no person chose one.
    const parents = new Map([...byId.values()].map((row) => [row.id, row.parentId]));
    const parentUpdates: Array<{ id: string; parentId: string | null }> = [];

    for (const entry of entries) {
      const id = ingredientOf.get(entry.offId);
      const row = id ? byId.get(id) : undefined;

      if (!id || !row || row.parentChosen) continue;

      const parentId = entry.parentOffId ? (ingredientOf.get(entry.parentOffId) ?? null) : null;

      // A parent the resolver set from an AI answer stays where the file has none.
      if (parentId === null || parentId === row.parentId || parentId === id) continue;
      if (parentId && closesCycle(parents, id, parentId)) {
        outcome.parentCycles += 1;
        continue;
      }
      parents.set(id, parentId);
      parentUpdates.push({ id, parentId });
    }

    for (const part of chunks(parentUpdates)) {
      const values = sql.join(
        part.map(({ id, parentId }) => sql`(${id}::uuid, ${parentId}::uuid)`),
        sql`, `
      );

      await tx.execute(sql`
        update ${ingredients} set parent_id = v.parent_id
        from (values ${values}) as v(id, parent_id)
        where ${ingredients}.id = v.id`);
    }
    outcome.parentsSet = parentUpdates.length;

    // Nutrition codes, where the file changed them: a code fixed upstream
    // arrives with the next refresh.
    const codeUpdates: Array<{ id: string; codes: NutritionCodes | null }> = [];

    for (const entry of entries) {
      const id = ingredientOf.get(entry.offId);
      const row = id ? byId.get(id) : undefined;

      if (!id || !row || codesKey(row.nutritionCodes) === codesKey(entry.nutrition)) continue;
      row.nutritionCodes = entry.nutrition;
      codeUpdates.push({ id, codes: entry.nutrition });
    }

    for (const part of chunks(codeUpdates)) {
      const values = sql.join(
        part.map(
          ({ id, codes }) => sql`(${id}::uuid, ${codes ? JSON.stringify(codes) : null}::jsonb)`
        ),
        sql`, `
      );

      await tx.execute(sql`
        update ${ingredients} set nutrition_codes = v.codes
        from (values ${values}) as v(id, codes)
        where ${ingredients}.id = v.id`);
    }
    outcome.nutritionChanged = codeUpdates.length;

    outcome.removed = await removeUnusedDropped(
      tx,
      entries.map((entry) => entry.offId)
    );

    return outcome;
  });
}

/** Remove the seeded Ingredients the file no longer lists, where nothing uses them. */
async function removeUnusedDropped(tx: DbTransaction, listed: readonly string[]): Promise<number> {
  const usedThroughAlias = (table: typeof recipeIngredients | typeof groceries) => sql`exists (
    select 1 from ${ingredientAliases} a join ${table} r on r.ingredient_alias_id = a.id
    where a.ingredient_id = ${ingredients.id})`;
  const usedById = (
    table:
      | typeof aisleLinks
      | typeof storeProductLinks
      | typeof ingredientStorePreferences
      | typeof ingredientNutritionCorrections
      | typeof pantryIngredients
      | typeof recurringGroceries
      | typeof groceries
  ) => sql`exists (select 1 from ${table} r where r.ingredient_id = ${ingredients.id})`;

  const removed = await tx
    .delete(ingredients)
    .where(
      and(
        isNotNull(ingredients.offId),
        isNull(ingredients.ownerId),
        // One array parameter, not one per entry: a statement holds at most 65,535.
        listed.length > 0
          ? sql`${ingredients.offId} <> all(${sql.param([...listed])}::text[])`
          : undefined,
        sql`not ${usedThroughAlias(recipeIngredients)}`,
        sql`not ${usedThroughAlias(groceries)}`,
        sql`not ${usedById(recurringGroceries)}`,
        // A grocery the upgrade has not given an alias yet points at its food alone.
        sql`not ${usedById(groceries)}`,
        sql`not ${usedById(pantryIngredients)}`,
        sql`not ${usedById(aisleLinks)}`,
        sql`not ${usedById(storeProductLinks)}`,
        sql`not ${usedById(ingredientStorePreferences)}`,
        sql`not ${usedById(ingredientNutritionCorrections)}`,
        sql`not exists (select 1 from ${ingredientAliases} a where a.ingredient_id = ${ingredients.id} and not a.seeded)`,
        sql`not exists (select 1 from ${ingredients} c where c.parent_id = ${ingredients.id})`
      )
    )
    .returning({ id: ingredients.id });

  return removed.length;
}

/** Every seeded Ingredient, by the taxonomy entry it stands for. */
export async function listSeededIngredientIds(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: ingredients.id, offId: ingredients.offId })
    .from(ingredients)
    .where(isNotNull(ingredients.offId));

  return new Map(rows.map((row) => [row.offId!, row.id]));
}

/** Every spelling of every Ingredient that is no taxonomy entry: what the seed's one pass reads. */
export async function listUnseededSpellings(): Promise<
  Array<{ ingredientId: string; text: string; fold: string }>
> {
  return await db
    .select({
      ingredientId: ingredientAliases.ingredientId,
      text: ingredientAliases.text,
      fold: ingredientAliases.fold,
    })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .where(isNull(ingredients.offId));
}

/** Flag an Ingredient: the seed's one pass was not sure which entry it is. */
export async function flagIngredient(id: string): Promise<void> {
  await db
    .update(ingredients)
    .set({ flagged: true, flagReason: "seed-ambiguous", version: sql`${ingredients.version} + 1` })
    .where(eq(ingredients.id, id));
}

/**
 * The Flagged Ingredients Norish minted itself and no person has decided
 * about: no taxonomy entry, not kept distinct, no parent a person chose (a
 * rename clears the flag, so a flagged one was not renamed since). What the
 * startup pass looks at again whenever the resolver's rules change.
 */
export async function listUndecidedMints(): Promise<
  Array<{ id: string; name: string; parentId: string | null; aliases: string[] }>
> {
  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      parentId: ingredients.parentId,
      alias: ingredientAliases.text,
    })
    .from(ingredients)
    .innerJoin(ingredientAliases, eq(ingredientAliases.ingredientId, ingredients.id))
    .where(
      and(
        eq(ingredients.flagged, true),
        isNull(ingredients.offId),
        eq(ingredients.keptDistinct, false),
        eq(ingredients.parentChosen, false)
      )
    )
    .orderBy(ingredients.createdAt, ingredients.id, ingredientAliases.createdAt);
  const byId = new Map<
    string,
    { id: string; name: string; parentId: string | null; aliases: string[] }
  >();

  for (const row of rows) {
    const mint = byId.get(row.id) ?? {
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      aliases: [],
    };

    mint.aliases.push(row.alias);
    byId.set(row.id, mint);
  }

  return [...byId.values()];
}

/**
 * File an undecided mint under the parent its words suggest, leaving it
 * flagged and the parent unchosen: only where it still has no parent, no
 * person decided about it meanwhile, and the parent would close no cycle.
 * Whether it was filed.
 */
export async function fileUndecidedMint(id: string, parentId: string): Promise<boolean> {
  return await db.transaction(async (tx) => {
    await lockTree(tx);
    if ((await findIngredientAncestors([parentId], tx)).get(parentId)?.includes(id)) return false;
    if (id === parentId) return false;

    const filed = await tx
      .update(ingredients)
      .set({ parentId, version: sql`${ingredients.version} + 1` })
      .where(
        and(
          eq(ingredients.id, id),
          isNull(ingredients.parentId),
          eq(ingredients.flagged, true),
          eq(ingredients.keptDistinct, false),
          eq(ingredients.parentChosen, false)
        )
      )
      .returning({ id: ingredients.id });

    return filed.length > 0;
  });
}

/** The whole catalogue, for the export the ODbL asks be offered. */
export async function listCatalogueForExport(): Promise<{
  ingredients: Array<{
    id: string;
    name: string;
    parentId: string | null;
    offId: string | null;
    nutritionCodes: NutritionCodes | null;
  }>;
  aliases: Array<{ ingredientId: string; text: string; locale: string | null }>;
}> {
  const [ingredientRows, aliasRows] = await Promise.all([
    db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        parentId: ingredients.parentId,
        offId: ingredients.offId,
        nutritionCodes: ingredients.nutritionCodes,
      })
      .from(ingredients)
      .orderBy(sql`lower(${ingredients.name})`),
    db
      .select({
        ingredientId: ingredientAliases.ingredientId,
        text: ingredientAliases.text,
        locale: ingredientAliases.locale,
      })
      .from(ingredientAliases)
      .orderBy(ingredientAliases.createdAt, ingredientAliases.id),
  ]);

  return { ingredients: ingredientRows, aliases: aliasRows };
}
