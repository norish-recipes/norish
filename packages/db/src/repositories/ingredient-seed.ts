import type { SQL } from "drizzle-orm";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import type { NutritionCodes } from "@norish/db/schema";
import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  ingredientAliases,
  ingredientNutritionCorrections,
  ingredients,
  ingredientStorePreferences,
  storeProductLinks,
} from "@norish/db/schema";

import type { NamingRows } from "./ingredient-cleanup";
import {
  clearAIFlagUnlessOpen,
  parentIsOpenAnswer,
  takeOpenParentChanges,
  vouchForOpenAIChanges,
  wasParentUndone,
} from "./ingredient-ai-changes";
import {
  deleteCatalogueAlias,
  ingredientIsListed,
  ingredientIsNamed,
  nameIsFree,
} from "./ingredient-catalogue";
import { findRowsNamingSpellings } from "./ingredient-cleanup";
import { closesCycle, lockFoods, lockTree, moveCatalogueAlias } from "./ingredient-relocation";

/**
 * The catalogue seed's writes (ADR-0038): seeded Ingredients, aliases and parents are upserted, and
 * what a person made (an own alias, a merge, a move, a parent) outlives every refresh.
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
): Promise<Map<string, { ingredientId: string; locale: string | null; seeded: boolean }>> {
  const held = new Map<string, { ingredientId: string; locale: string | null; seeded: boolean }>();

  for (const part of chunks([...new Set(folds)])) {
    const rows = await tx
      .select({
        fold: ingredientAliases.fold,
        ingredientId: ingredientAliases.ingredientId,
        locale: ingredientAliases.locale,
        seeded: ingredientAliases.seeded,
      })
      .from(ingredientAliases)
      .where(inArray(ingredientAliases.fold, part));

    for (const { fold, ...holder } of rows) held.set(fold, holder);
  }

  return held;
}

/** Whether giving `id` the parent `parentId` would make it its own ancestor. */
function closesCycleIn(parents: ReadonlyMap<string, string | null>, id: string, parentId: string) {
  let current: string | null | undefined = parentId;

  for (let depth = 0; current && depth < 64; depth += 1) {
    if (current === id) return true;
    current = parents.get(current);
  }

  return false;
}

/**
 * Apply a parsed seed in one transaction: an entry finds (by id, else name, adopting it) or mints
 * its food, adds its spellings and a parent no person set; a dropped food goes only unused.
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

      const holder =
        nameHolders.get(entry.nameFold)?.ingredientId ?? byName.get(entry.name.toLowerCase());
      const row = holder ? byId.get(holder) : undefined;

      if (!row) {
        toCreate.push(entry);
      } else if (row.offId === null && !adopted.has(row.id)) {
        adopted.add(row.id);
        ingredientOf.set(entry.offId, row.id);
        await tx
          .update(ingredients)
          .set({
            offId: entry.offId,
            name: sql`case when exists (select 1 from ${ingredients} o where o.id <> ${row.id} and lower(o.name) = lower(${entry.name})) then ${ingredients.name} else ${entry.name} end`,
            flagged: false,
            flagReason: null,
            version: sql`${ingredients.version} + 1`,
          })
          .where(eq(ingredients.id, row.id));
        // The seed vouches for the food: it files it, and AI's merges into it are sure.
        await takeOpenParentChanges(tx, row.id);
        await vouchForOpenAIChanges(tx, row.id);
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
    const restamps: Array<{ fold: string; locale: string | null }> = [];

    for (const fold of notAdded) {
      const claim = wanted.get(fold)!;
      const holder = holders.get(fold);

      if (holder?.ingredientId !== claim.row.ingredientId) {
        outcome.aliasCollisions.push({ fold, offId: claim.offId });
      } else if (holder.seeded && holder.locale !== (claim.row.locale ?? null)) {
        restamps.push({ fold, locale: claim.row.locale ?? null });
      }
    }

    // A spelling the entry keeps takes the language the file now gives it first.
    for (const part of chunks(restamps)) {
      const values = sql.join(
        part.map(({ fold, locale }) => sql`(${fold}, ${locale}::text)`),
        sql`, `
      );

      await tx.execute(sql`
        update ${ingredientAliases} set locale = v.locale
        from (values ${values}) as v(fold, locale)
        where ${ingredientAliases}.fold = v.fold`);
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
      if (parentId && closesCycleIn(parents, id, parentId)) {
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
  const usedById = (
    table:
      | typeof aisleLinks
      | typeof storeProductLinks
      | typeof ingredientStorePreferences
      | typeof ingredientNutritionCorrections
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
        sql`not ${ingredientIsNamed()}`,
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

/** One Ingredient with its seeded spellings, each in its own language, outside a seed file; its id. */
export async function insertSeededIngredient(
  ingredient: typeof ingredients.$inferInsert,
  aliases: ReadonlyArray<{ text: string; fold: string; locale: string | null }>
): Promise<string> {
  return await db.transaction(async (tx) => {
    const [row] = await tx.insert(ingredients).values(ingredient).returning({ id: ingredients.id });

    if (!row) throw new Error("Failed to insert ingredient");
    if (aliases.length > 0) {
      await tx
        .insert(ingredientAliases)
        .values(aliases.map((alias) => ({ ...alias, ingredientId: row.id, seeded: true })));
    }

    return row.id;
  });
}

/** The spelling `fold` on `fromId`, its foods locked; null where one of them is gone. */
async function lockSpellingOn(
  tx: DbTransaction,
  fold: string,
  fromId: string,
  foodIds: readonly string[]
): Promise<string | null> {
  if (!(await lockFoods(tx, foodIds))) return null;
  const [alias] = await tx
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(and(eq(ingredientAliases.fold, fold), eq(ingredientAliases.ingredientId, fromId)));

  return alias?.id ?? null;
}

/** Move a seeded spelling, with its rows, from one seeded food to another that the seed now gives it. */
export async function moveSeededSpelling(
  fold: string,
  fromId: string,
  toId: string
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const aliasId = await lockSpellingOn(tx, fold, fromId, [fromId, toId]);

    if (!aliasId) return false;
    await moveCatalogueAlias(tx, aliasId, toId);

    return true;
  });
}

/** Take a seeded spelling the seed gives no food off its food; the rows that named it, to read again. */
export async function takeOffSeededSpelling(
  fold: string,
  fromId: string
): Promise<NamingRows | null> {
  return await db.transaction(async (tx) => {
    const aliasId = await lockSpellingOn(tx, fold, fromId, [fromId]);

    if (!aliasId) return null;
    const rows = await findRowsNamingSpellings(tx, [aliasId]);

    await deleteCatalogueAlias(tx, aliasId);

    return rows;
  });
}

/** The listed own foods under `parentId` that no person filed there. */
export async function listUnchosenOwnChildren(
  parentId: string
): Promise<Array<{ id: string; name: string }>> {
  return await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(
      and(
        eq(ingredients.parentId, parentId),
        isNull(ingredients.offId),
        eq(ingredients.parentChosen, false),
        // A hidden food (a grocery's) keeps its parent, and so its aisle.
        ingredientIsListed()
      )
    );
}

/** Re-file an own food the words filed under `fromId` under `toId` (`fileUnder`). Whether it moved. */
export async function refileOwnFood(id: string, fromId: string, toId: string): Promise<boolean> {
  return await fileUnder(
    id,
    toId,
    and(eq(ingredients.parentId, fromId), isNull(ingredients.offId))
  );
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

/** An undecided mint; `answered`: AI's parent answer about it is open. */
export interface UndecidedMint {
  id: string;
  name: string;
  parentId: string | null;
  answered: boolean;
  aliases: string[];
}

/**
 * The listed own Ingredients no person decided about (no entry, not distinct, no chosen parent),
 * flagged or not, which the startup recheck reads again when the rules change.
 */
export async function listUndecidedMints(): Promise<UndecidedMint[]> {
  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      parentId: ingredients.parentId,
      answered: parentIsOpenAnswer,
      alias: ingredientAliases.text,
    })
    .from(ingredients)
    .innerJoin(ingredientAliases, eq(ingredientAliases.ingredientId, ingredients.id))
    .where(
      and(
        isNull(ingredients.offId),
        eq(ingredients.keptDistinct, false),
        eq(ingredients.parentChosen, false),
        // A hidden food (a grocery's) is left alone: its aisle walks its parent.
        ingredientIsListed()
      )
    )
    .orderBy(ingredients.createdAt, ingredients.id, ingredientAliases.createdAt);
  const byId = new Map<string, UndecidedMint>();

  for (const row of rows) {
    const mint = byId.get(row.id) ?? {
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      answered: row.answered,
      aliases: [],
    };

    mint.aliases.push(row.alias);
    byId.set(row.id, mint);
  }

  return [...byId.values()];
}

/**
 * Give an undecided mint today's plain name as a spelling, and as its name where it keeps its
 * minted text and the name is free and unsettled; a spelling another food holds stays.
 */
export async function adoptPlainName(
  id: string,
  plain: { text: string; fold: string }
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(ingredientAliases)
      .values({ text: plain.text, fold: plain.fold, ingredientId: id, ownerId: null })
      .onConflictDoNothing();
    await tx
      .update(ingredients)
      .set({ name: plain.text, version: sql`${ingredients.version} + 1` })
      .where(
        and(
          eq(ingredients.id, id),
          eq(ingredients.parentChosen, false),
          eq(ingredients.nameSettled, false),
          nameIsFree(id, plain.text)
        )
      );
  });
}

/**
 * File an undecided mint without a parent under its words' one, its flag as it was, unless a person
 * decided about it meanwhile or a cycle closes. Whether it was filed.
 */
export async function fileUndecidedMint(id: string, parentId: string): Promise<boolean> {
  return await fileUnder(id, parentId, isNull(ingredients.parentId));
}

/**
 * File the words' parent where `where` still holds, no person decided (kept distinct, kept a
 * change or chose a parent), no cycle closes and no person undid it. Whether it was filed.
 */
async function fileUnder(id: string, parentId: string, where: SQL | undefined): Promise<boolean> {
  return await db.transaction(async (tx) => {
    await lockTree(tx);
    if (await closesCycle(tx, id, parentId)) return false;
    // A person undid this parent once: AI and the words never set it again.
    if (await wasParentUndone(tx, id, parentId)) return false;

    const filed = await tx
      .update(ingredients)
      .set({ parentId, version: sql`${ingredients.version} + 1` })
      .where(
        and(
          eq(ingredients.id, id),
          where,
          eq(ingredients.keptDistinct, false),
          eq(ingredients.parentChosen, false)
        )
      )
      .returning({ id: ingredients.id });

    if (filed.length === 0) return false;
    // AI's open answer goes with the old parent; the words' parent leaves no doubt behind.
    if (await takeOpenParentChanges(tx, id)) await clearAIFlagUnlessOpen(tx, id);

    return true;
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
