import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type { AIChangeUndo, ChangedSpelling, DeletedFood } from "@norish/db/schema";
import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import { db } from "@norish/db/drizzle";
import {
  groceries,
  ingredientAIChanges,
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredientFoods,
  recipeIngredients,
  recurringGroceries,
  users,
} from "@norish/db/schema";

import { findGroceryRows, nameIsFree, rowsNaming } from "./ingredient-catalogue";
import { repointLines } from "./ingredient-cleanup";

/**
 * AI Changes (ADR-0037, amended 2026-10-17): written in the transaction that made them, kept or
 * undone by a person. The edit policy is checked in `@norish/shared-server/ingredients`.
 */

/**
 * One AI Change as Changed by AI lists it: the food it is listed under and the one it names. A
 * deleted food's has none: its food is in `undo`.
 */
export interface StoredAIChange {
  id: string;
  sure: boolean;
  kept: boolean;
  createdAt: Date;
  ingredient: { id: string; name: string; ownerId: string | null } | null;
  target: { id: string; name: string } | null;
  /** The parent a change to no parent took away. */
  dropped: { id: string; name: string } | null;
  undo: AIChangeUndo;
}

/** Record what AI just did, through the transaction that did it; answers its id. */
export async function recordAIChange(
  tx: Db,
  change: {
    ingredientId?: string | null;
    targetId?: string | null;
    sure: boolean;
    undo: AIChangeUndo;
  }
): Promise<string> {
  const [row] = await tx
    .insert(ingredientAIChanges)
    .values({
      kind: change.undo.kind,
      ingredientId: change.ingredientId ?? null,
      targetId: change.targetId ?? null,
      sure: change.sure,
      undo: change.undo,
    })
    .returning({ id: ingredientAIChanges.id });

  return row!.id;
}

const targets = alias(ingredients, "ai_change_targets");
const dropped = alias(ingredients, "ai_change_dropped");

/** How long Changed by AI lists a change a person has no more to do about. */
const LISTED_FOR = sql`interval '30 days'`;

/** Unsure, and neither kept nor undone: what flags its food. */
const open = and(
  eq(ingredientAIChanges.sure, false),
  isNull(ingredientAIChanges.keptAt),
  isNull(ingredientAIChanges.undoneAt)
);

/** Whether an open change is listed under the food. */
function hasOpenChange(ingredientId: string) {
  return sql`exists (select 1 from ${ingredientAIChanges} where ${and(
    eq(ingredientAIChanges.ingredientId, ingredientId),
    open
  )})`;
}

/** Whether AI's parent answer about a food is still open, in a query over `ingredients`. */
export const parentIsOpenAnswer = sql<boolean>`exists (select 1 from ${ingredientAIChanges} where ${and(
  eq(ingredientAIChanges.ingredientId, ingredients.id),
  eq(ingredientAIChanges.kind, "parent"),
  open
)})`;

function selectChanges(tx: Db = db) {
  return tx
    .select({
      id: ingredientAIChanges.id,
      sure: ingredientAIChanges.sure,
      keptAt: ingredientAIChanges.keptAt,
      createdAt: ingredientAIChanges.createdAt,
      ingredientId: ingredients.id,
      ingredientName: ingredients.name,
      ingredientOwnerId: ingredients.ownerId,
      targetId: targets.id,
      targetName: targets.name,
      droppedId: dropped.id,
      droppedName: dropped.name,
      undo: ingredientAIChanges.undo,
    })
    .from(ingredientAIChanges)
    .leftJoin(ingredients, eq(ingredients.id, ingredientAIChanges.ingredientId))
    .leftJoin(targets, eq(targets.id, ingredientAIChanges.targetId))
    .leftJoin(
      dropped,
      and(
        eq(ingredientAIChanges.kind, "parent"),
        isNull(ingredientAIChanges.targetId),
        sql`${dropped.id} = (${ingredientAIChanges.undo} ->> 'formerParentId')::uuid`
      )
    );
}

type ChangeRow = Awaited<ReturnType<typeof selectChanges>>[number];

function toStoredChange(row: ChangeRow): StoredAIChange {
  return {
    id: row.id,
    sure: row.sure,
    kept: row.keptAt !== null,
    createdAt: row.createdAt,
    ingredient:
      row.ingredientId && row.ingredientName !== null
        ? { id: row.ingredientId, name: row.ingredientName, ownerId: row.ingredientOwnerId }
        : null,
    target: row.targetId && row.targetName ? { id: row.targetId, name: row.targetName } : null,
    dropped: row.droppedId && row.droppedName ? { id: row.droppedId, name: row.droppedName } : null,
    undo: row.undo,
  };
}

/**
 * Open changes first, longest waiting first; then the last month's others, newest first, those
 * made before `clearedAt` left out.
 */
export async function listAIChanges(clearedAt?: Date): Promise<StoredAIChange[]> {
  const settled = and(
    sql`${ingredientAIChanges.createdAt} > now() - ${LISTED_FOR}`,
    clearedAt ? gt(ingredientAIChanges.createdAt, clearedAt) : undefined
  );
  const rows = await selectChanges()
    .where(and(isNull(ingredientAIChanges.undoneAt), or(open, settled)))
    .orderBy(
      desc(sql`${open}`),
      sql`case when ${open} then ${ingredientAIChanges.createdAt} end asc`,
      desc(ingredientAIChanges.createdAt),
      asc(ingredientAIChanges.id)
    );

  return rows.map(toStoredChange);
}

/**
 * Delete the changes Changed by AI no longer lists: sure or kept, and older than a month. An
 * undone one stays, as the memory AI checks, and an open one until a person handles it.
 */
export async function sweepAIChanges(): Promise<number> {
  const swept = await db
    .delete(ingredientAIChanges)
    .where(
      and(
        isNull(ingredientAIChanges.undoneAt),
        sql`not ${open}`,
        sql`${ingredientAIChanges.createdAt} <= now() - ${LISTED_FOR}`
      )
    )
    .returning({ id: ingredientAIChanges.id });

  return swept.length;
}

/** One change, locked for a Keep or an Undo; null where it is gone or already undone. */
export async function lockAIChange(tx: DbTransaction, id: string): Promise<StoredAIChange | null> {
  const [row] = await selectChanges(tx)
    .where(and(eq(ingredientAIChanges.id, id), isNull(ingredientAIChanges.undoneAt)))
    .for("update", { of: ingredientAIChanges });

  return row ? toStoredChange(row) : null;
}

/** Mark a change kept or undone. */
export async function settleAIChange(
  tx: DbTransaction,
  id: string,
  how: "kept" | "undone"
): Promise<void> {
  await tx
    .update(ingredientAIChanges)
    .set(how === "kept" ? { keptAt: new Date() } : { undoneAt: new Date() })
    .where(eq(ingredientAIChanges.id, id));
}

/** Keep every open change listed under a food: a person looked after it. */
export async function keepOpenAIChangesOf(tx: Db, ingredientId: string): Promise<void> {
  await tx
    .update(ingredientAIChanges)
    .set({ keptAt: new Date() })
    .where(and(eq(ingredientAIChanges.ingredientId, ingredientId), open));
}

/** Make a food's open changes sure: the seed vouched for the food, so none of them flags it. */
export async function vouchForOpenAIChanges(tx: Db, ingredientId: string): Promise<void> {
  await tx
    .update(ingredientAIChanges)
    .set({ sure: true })
    .where(and(eq(ingredientAIChanges.ingredientId, ingredientId), open));
}

/**
 * Drop a food's open parent changes, which a newer answer replaces; returns the parent the
 * oldest of them found the food under.
 */
export async function takeOpenParentChanges(
  tx: Db,
  ingredientId: string
): Promise<{ formerParentId: string | null } | null> {
  const taken = await tx
    .delete(ingredientAIChanges)
    .where(
      and(
        eq(ingredientAIChanges.ingredientId, ingredientId),
        eq(ingredientAIChanges.kind, "parent"),
        open
      )
    )
    .returning({ createdAt: ingredientAIChanges.createdAt, undo: ingredientAIChanges.undo });
  const [oldest] = taken.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return oldest?.undo.kind === "parent" ? { formerParentId: oldest.undo.formerParentId } : null;
}

/** A merge moves the source's merges into it, and parent changes naming it, to the target. */
export async function moveMergedAIChanges(
  tx: DbTransaction,
  sourceId: string,
  targetId: string
): Promise<void> {
  await tx
    .update(ingredientAIChanges)
    .set({ ingredientId: targetId })
    .where(
      and(eq(ingredientAIChanges.ingredientId, sourceId), eq(ingredientAIChanges.kind, "merge"))
    );
  await tx
    .update(ingredientAIChanges)
    .set({ targetId })
    .where(eq(ingredientAIChanges.targetId, sourceId));
  await tx
    .update(ingredientAIChanges)
    .set({
      undo: sql`jsonb_set(${ingredientAIChanges.undo}, '{formerParentId}', to_jsonb(${targetId}::text))`,
    })
    .where(
      and(
        eq(ingredientAIChanges.kind, "parent"),
        sql`${ingredientAIChanges.undo} ->> 'formerParentId' = ${sourceId}`
      )
    );
}

/** Whether a person undid a merge of any of these spellings into `intoId`. */
export async function wasMergeUndone(
  tx: Db,
  intoId: string,
  aliasIds: readonly string[]
): Promise<boolean> {
  if (aliasIds.length === 0) return false;
  const [row] = await tx
    .select({ id: ingredientAIChanges.id })
    .from(ingredientAIChanges)
    .where(
      and(
        eq(ingredientAIChanges.ingredientId, intoId),
        eq(ingredientAIChanges.kind, "merge"),
        sql`${ingredientAIChanges.undoneAt} is not null`,
        sql`${ingredientAIChanges.undo} -> 'aliasIds' ?| ${sql`array[${sql.join(
          aliasIds.map((id) => sql`${id}`),
          sql`, `
        )}]::text[]`}`
      )
    )
    .limit(1);

  return row !== undefined;
}

/** The names AI read in the AI Changes not undone onto a food: a merged food's, a moved spelling. */
export async function listNamesAIReadOnto(ingredientId: string): Promise<string[]> {
  const rows = await db
    .select({ undo: ingredientAIChanges.undo })
    .from(ingredientAIChanges)
    .where(
      and(
        isNull(ingredientAIChanges.undoneAt),
        or(
          and(
            eq(ingredientAIChanges.kind, "merge"),
            eq(ingredientAIChanges.ingredientId, ingredientId)
          ),
          and(
            eq(ingredientAIChanges.kind, "spelling"),
            eq(ingredientAIChanges.targetId, ingredientId)
          )
        )
      )
    );

  return rows.flatMap(({ undo }) =>
    undo.kind === "merge" ? [undo.name] : undo.kind === "spelling" ? [undo.spelling.text] : []
  );
}

/** Whether a person undid filing `ingredientId` under `parentId`, or under no parent (null). */
export function wasParentUndone(tx: Db, ingredientId: string, parentId: string | null) {
  return hasParentChange(tx, ingredientId, parentId, true);
}

/** Whether AI filed `ingredientId` under `parentId` in a change still listed and not undone. */
export function wasParentSetByAI(ingredientId: string, parentId: string) {
  return hasParentChange(db, ingredientId, parentId, false);
}

async function hasParentChange(
  tx: Db,
  ingredientId: string,
  parentId: string | null,
  undone: boolean
): Promise<boolean> {
  const [row] = await tx
    .select({ id: ingredientAIChanges.id })
    .from(ingredientAIChanges)
    .where(
      and(
        eq(ingredientAIChanges.ingredientId, ingredientId),
        eq(ingredientAIChanges.kind, "parent"),
        parentId === null
          ? isNull(ingredientAIChanges.targetId)
          : eq(ingredientAIChanges.targetId, parentId),
        undone ? isNotNull(ingredientAIChanges.undoneAt) : isNull(ingredientAIChanges.undoneAt)
      )
    )
    .limit(1);

  return row !== undefined;
}

/**
 * Flag the food while it has an open change or AI just doubted it (`unsure`, for `reason`); clear
 * it otherwise.
 */
export async function refreshAIFlag(
  tx: Db,
  ingredientId: string,
  { unsure, reason = "ai-unsure" }: { unsure: boolean; reason?: FlagReason }
): Promise<void> {
  const flagged = sql`(${unsure} or ${hasOpenChange(ingredientId)})`;

  await tx
    .update(ingredients)
    .set({
      flagged,
      flagReason: sql`case when ${flagged} then ${unsure ? reason : "ai-unsure"} end`,
      version: sql`${ingredients.version} + 1`,
    })
    .where(eq(ingredients.id, ingredientId));
}

/** Flag the food an unsure change joined. */
export async function flagUnderOpenChange(tx: Db, ingredientId: string): Promise<void> {
  await tx
    .update(ingredients)
    .set({ flagged: true, flagReason: "ai-unsure", version: sql`${ingredients.version} + 1` })
    .where(eq(ingredients.id, ingredientId));
}

/** What earlier releases flagged a food for that is no flag now: AI waiting, off or failing. */
const RETIRED_FLAG_REASONS = ["ai-queued", "ai-off", "ai-unavailable", "ai-key-rejected"];

/** Lift every flag for a retired reason; a food under an open change keeps AI's doubt. How many. */
export async function clearRetiredFlags(tx: Db): Promise<number> {
  const doubted = sql`exists (select 1 from ${ingredientAIChanges} where ${and(
    sql`${ingredientAIChanges.ingredientId} = ${ingredients}.id`,
    open
  )})`;
  const cleared = await tx
    .update(ingredients)
    .set({
      flagged: doubted,
      flagReason: sql`case when ${doubted} then 'ai-unsure' end`,
      version: sql`${ingredients.version} + 1`,
    })
    .where(inArray(ingredients.flagReason, RETIRED_FLAG_REASONS))
    .returning({ id: ingredients.id });

  return cleared.length;
}

/** Clear AI's doubt once no open change is left; a flag for another reason is not AI's to clear. */
export async function clearAIFlagUnlessOpen(tx: Db, ingredientId: string): Promise<void> {
  await tx
    .update(ingredients)
    .set({ flagged: false, flagReason: null, version: sql`${ingredients.version} + 1` })
    .where(
      and(
        eq(ingredients.id, ingredientId),
        eq(ingredients.flagReason, "ai-unsure"),
        sql`not ${hasOpenChange(ingredientId)}`
      )
    );
}

/** What undoing a merge of this food would need: its name, owner, parent and spellings. */
export async function readMergeUndo(
  tx: Db,
  sourceId: string
): Promise<Extract<AIChangeUndo, { kind: "merge" }> | null> {
  const [food] = await tx
    .select({
      name: ingredients.name,
      ownerId: ingredients.ownerId,
      parentId: ingredients.parentId,
    })
    .from(ingredients)
    .where(eq(ingredients.id, sourceId));

  if (!food) return null;
  const aliases = await tx
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.ingredientId, sourceId));

  return { kind: "merge", ...food, aliasIds: aliases.map((row) => row.id) };
}

/** Which of these spellings still belong to `ingredientId`. */
export async function aliasesStillOn(
  tx: Db,
  ingredientId: string,
  aliasIds: readonly string[]
): Promise<string[]> {
  if (aliasIds.length === 0) return [];
  const rows = await tx
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.ingredientId, ingredientId),
        inArray(ingredientAliases.id, [...aliasIds])
      )
    );

  return rows.map((row) => row.id);
}

/** Give a food back the name AI replaced, while it still has AI's name and the old one is free. */
export async function restoreName(
  tx: Db,
  ingredientId: string,
  { name, formerName }: { name: string; formerName: string }
): Promise<void> {
  await tx
    .update(ingredients)
    .set({ name: formerName, version: sql`${ingredients.version} + 1` })
    .where(
      and(
        eq(ingredients.id, ingredientId),
        eq(ingredients.name, name),
        nameIsFree(ingredientId, formerName)
      )
    );
}

/** Whether a person undid AI deleting this food as not a food. */
export async function wasDeletionUndone(tx: Db, ingredientId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: ingredientAIChanges.id })
    .from(ingredientAIChanges)
    .where(
      and(
        eq(ingredientAIChanges.kind, "not-a-food"),
        isNotNull(ingredientAIChanges.undoneAt),
        sql`${ingredientAIChanges.undo} -> 'food' ->> 'ingredientId' = ${ingredientId}`
      )
    )
    .limit(1);

  return row !== undefined;
}

/** Whether a Pantry Ingredient names the food: AI never deletes one a person typed. */
export async function isInAnyPantry(tx: Db, ingredientId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: pantryIngredients.id })
    .from(pantryIngredients)
    .where(eq(pantryIngredients.ingredientId, ingredientId))
    .limit(1);

  return row !== undefined;
}

/** A food as Undo would mint it again: its spellings and every row naming it, read before it goes. */
export async function readDeletedFood(
  tx: DbTransaction,
  ingredientId: string
): Promise<DeletedFood | null> {
  const [food] = await tx
    .select({
      name: ingredients.name,
      ownerId: ingredients.ownerId,
      parentId: ingredients.parentId,
    })
    .from(ingredients)
    .where(eq(ingredients.id, ingredientId));

  if (!food) return null;
  const aliases = await tx
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      fold: ingredientAliases.fold,
      locale: ingredientAliases.locale,
      ownerId: ingredientAliases.ownerId,
    })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.ingredientId, ingredientId));
  const naming = rowsNaming(ingredientId);
  const named = await findGroceryRows(tx, {
    groceries: naming.groceries,
    recurring: naming.recurringGroceries,
  });
  const pointers = (rows: typeof named.groceries) =>
    rows.map(({ id, aliasId }) => ({ id, aliasId }));

  return {
    ingredientId,
    ...food,
    aliases,
    lineFoods: await tx
      .select({
        lineId: recipeIngredientFoods.recipeIngredientId,
        position: recipeIngredientFoods.position,
        aliasId: recipeIngredientFoods.ingredientAliasId,
      })
      .from(recipeIngredientFoods)
      .where(naming.lineFoods),
    groceries: pointers(named.groceries),
    recurring: pointers(named.recurring),
  };
}

/** The row's id where it is still there, so a restore never points at one deleted since. */
function stillThere(table: typeof users | typeof ingredients, id: string | null) {
  return id === null ? null : sql`(select id from ${table} where id = ${id})`;
}

/**
 * Mint a deleted food again under its ids, with the spellings still free, pointing back the rows
 * that named it and name nothing now; false where no spelling is free, throws where the name is taken.
 */
export async function restoreDeletedFood(tx: DbTransaction, food: DeletedFood): Promise<boolean> {
  await tx.insert(ingredients).values({
    id: food.ingredientId,
    name: food.name,
    ownerId: stillThere(users, food.ownerId),
    parentId: stillThere(ingredients, food.parentId),
  });
  const restored = await tx
    .insert(ingredientAliases)
    .values(
      food.aliases.map((spelling) => ({
        ...spelling,
        ingredientId: food.ingredientId,
        ownerId: stillThere(users, spelling.ownerId),
      }))
    )
    .onConflictDoNothing()
    .returning({ id: ingredientAliases.id });
  const back = new Set(restored.map((row) => row.id));

  if (back.size === 0) return false;
  for (const { lineId, position, aliasId } of food.lineFoods) {
    if (!back.has(aliasId)) continue;
    await tx.execute(sql`
      insert into ${recipeIngredientFoods} (recipe_ingredient_id, position, ingredient_alias_id)
      select id, ${position}, ${aliasId} from ${recipeIngredients} where id = ${lineId}
      on conflict do nothing`);
  }
  const free = (row: { aliasId: string | null }) => row.aliasId === null || back.has(row.aliasId);

  await pointBack(tx, food.ingredientId, [
    [groceries, food.groceries.filter(free)],
    [recurringGroceries, food.recurring.filter(free)],
  ]);

  return true;
}

/** A Grocery or recurring grocery to point back, and the spelling it may still name instead of none. */
interface Pointer {
  id: string;
  aliasId: string | null;
  left?: string;
}

/** Point rows back at a restored food where they name no food now, or still the `left` spelling. */
async function pointBack(
  tx: DbTransaction,
  ingredientId: string,
  tables: ReadonlyArray<readonly [typeof groceries | typeof recurringGroceries, Pointer[]]>
): Promise<void> {
  for (const [table, rows] of tables) {
    for (const row of rows) {
      await tx
        .update(table)
        .set({ ingredientAliasId: row.aliasId, ingredientId, version: sql`${table.version} + 1` })
        .where(
          and(
            eq(table.id, row.id),
            or(
              and(isNull(table.ingredientAliasId), isNull(table.ingredientId)),
              row.left ? eq(table.ingredientAliasId, row.left) : undefined
            )
          )
        );
    }
  }
}

/** A spelling as Undo of its removal or move would put it back, with its food and whether seeded. */
export async function readChangedSpelling(
  tx: DbTransaction,
  aliasId: string
): Promise<(ChangedSpelling["spelling"] & { ingredientId: string; seeded: boolean }) | null> {
  const [row] = await tx
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      fold: ingredientAliases.fold,
      locale: ingredientAliases.locale,
      ownerId: ingredientAliases.ownerId,
      ingredientId: ingredientAliases.ingredientId,
      seeded: ingredientAliases.seeded,
    })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.id, aliasId));

  return row ?? null;
}

/** These lines' foods in order, with how they go together; a line naming none is left out. */
export async function readLineFoods(
  tx: Db,
  lineIds: readonly string[]
): Promise<ChangedSpelling["lines"]> {
  if (lineIds.length === 0) return [];
  const foods = await tx
    .select({
      lineId: recipeIngredientFoods.recipeIngredientId,
      aliasId: recipeIngredientFoods.ingredientAliasId,
      joined: recipeIngredients.joined,
    })
    .from(recipeIngredientFoods)
    .innerJoin(
      recipeIngredients,
      eq(recipeIngredients.id, recipeIngredientFoods.recipeIngredientId)
    )
    .where(inArray(recipeIngredientFoods.recipeIngredientId, [...lineIds]))
    .orderBy(asc(recipeIngredientFoods.recipeIngredientId), asc(recipeIngredientFoods.position));
  const lines = new Map<string, ChangedSpelling["lines"][number]>();

  for (const food of foods) {
    const line = lines.get(food.lineId) ?? { id: food.lineId, aliasIds: [], joined: food.joined };

    line.aliasIds.push(food.aliasId);
    lines.set(food.lineId, line);
  }

  return [...lines.values()];
}

/** The spellings each of a removal's rows names now, by row id: what Undo may still point back. */
async function namedNow(tx: Db, undo: ChangedSpelling): Promise<Map<string, string[]>> {
  const named = await findGroceryRows(tx, {
    groceries: inArray(groceries.id, undo.groceries),
    recurring: inArray(recurringGroceries.id, undo.recurring),
  });
  const rows = [...named.groceries, ...named.recurring];

  return new Map([
    ...(
      await readLineFoods(
        tx,
        undo.lines.map((line) => line.id)
      )
    ).map((line) => [line.id, line.aliasIds] as const),
    ...rows.map((row) => [row.id, row.aliasId ? [row.aliasId] : []] as const),
  ]);
}

/** Note on a spelling's removal what its rows name once read again, for its Undo. */
export async function noteSpellingRemovalLeft(changeId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [change] = await tx
      .select({ undo: ingredientAIChanges.undo })
      .from(ingredientAIChanges)
      .where(eq(ingredientAIChanges.id, changeId))
      .for("update");

    if (change?.undo.kind !== "spelling") return;
    const left = Object.fromEntries(await namedNow(tx, change.undo));

    await tx
      .update(ingredientAIChanges)
      .set({ undo: { ...change.undo, left } })
      .where(eq(ingredientAIChanges.id, changeId));
  });
}

/** Whether a person undid AI removing or moving this spelling. */
export async function wasSpellingUndone(tx: Db, aliasId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: ingredientAIChanges.id })
    .from(ingredientAIChanges)
    .where(
      and(
        eq(ingredientAIChanges.kind, "spelling"),
        isNotNull(ingredientAIChanges.undoneAt),
        sql`${ingredientAIChanges.undo} -> 'spelling' ->> 'id' = ${aliasId}`
      )
    )
    .limit(1);

  return row !== undefined;
}

/**
 * The own food holding `fold` that was minted after `since` and nobody decided about: what reading
 * a removed spelling's rows again minted from its text.
 */
export async function findMintHolding(tx: Db, fold: string, since: Date): Promise<string | null> {
  const [row] = await tx
    .select({ id: ingredients.id })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .where(
      and(
        eq(ingredientAliases.fold, fold),
        isNull(ingredients.offId),
        gt(ingredients.createdAt, since),
        eq(ingredients.nameChosen, false),
        eq(ingredients.parentChosen, false),
        eq(ingredients.keptDistinct, false)
      )
    );

  return row?.id ?? null;
}

/**
 * Put a removed spelling back on its food under its id, pointing back the rows that name no food now
 * or still what the removal left them; false where another food holds its text.
 */
export async function restoreSpelling(
  tx: DbTransaction,
  ingredientId: string,
  undo: ChangedSpelling
): Promise<boolean> {
  const { spelling, left = {} } = undo;
  const [restored] = await tx
    .insert(ingredientAliases)
    .values({ ...spelling, ingredientId, ownerId: stillThere(users, spelling.ownerId) })
    .onConflictDoNothing()
    .returning({ id: ingredientAliases.id });
  // The text back on the food under another id (a mint merged back) is restored too.
  const [held] = restored
    ? [restored]
    : await tx
        .select({ id: ingredientAliases.id })
        .from(ingredientAliases)
        .where(
          and(
            eq(ingredientAliases.fold, spelling.fold),
            eq(ingredientAliases.ingredientId, ingredientId)
          )
        );

  if (!held) return false;
  const lines = undo.lines.map((line) => ({
    ...line,
    aliasIds: line.aliasIds.map((id) => (id === spelling.id ? held.id : id)),
  }));
  const wanted = [...new Set(lines.flatMap((line) => line.aliasIds))];
  const aliases = new Set(
    wanted.length === 0
      ? []
      : (
          await tx
            .select({ id: ingredientAliases.id })
            .from(ingredientAliases)
            .where(inArray(ingredientAliases.id, wanted))
        ).map((row) => row.id)
  );
  const present = new Set(
    lines.length === 0
      ? []
      : (
          await tx
            .select({ id: recipeIngredients.id })
            .from(recipeIngredients)
            .where(
              inArray(
                recipeIngredients.id,
                lines.map((line) => line.id)
              )
            )
        ).map((row) => row.id)
  );
  const now = await namedNow(tx, undo);
  const unchanged = (id: string) => {
    const named = now.get(id) ?? [];

    return named.length === 0 || named.join() === (left[id] ?? []).join();
  };
  const pointers = (ids: string[]) =>
    ids.map((id) => ({ id, aliasId: held.id, left: left[id]?.[0] }));

  await repointLines(
    tx,
    lines.filter(
      (line) =>
        present.has(line.id) && line.aliasIds.every((id) => aliases.has(id)) && unchanged(line.id)
    )
  );
  await pointBack(tx, ingredientId, [
    [groceries, pointers(undo.groceries)],
    [recurringGroceries, pointers(undo.recurring)],
  ]);

  return true;
}
