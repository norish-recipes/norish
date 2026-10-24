/**
 * AI Changes (CONTEXT.md; ADR-0037): AI's answers made and recorded in one transaction, kept or
 * undone under `edit` on their food.
 */
import { AsyncLocalStorage } from "node:async_hooks";

import type { DbTransaction } from "@norish/db/drizzle";
import type { StoredAIChange } from "@norish/db/repositories/ingredient-ai-changes";
import type { SplitPart } from "@norish/db/repositories/ingredient-relocation";
import type { AIChangeKind, FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { NamedFood } from "@norish/shared/lib/ingredient-names";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import { withTransaction } from "@norish/db/drizzle";
import {
  aliasesStillOn,
  clearAIFlagUnlessOpen,
  findMintHolding,
  flagUnderOpenChange,
  isInAnyPantry,
  listAIChanges,
  lockAIChange,
  noteSpellingRemovalLeft,
  readChangedSpelling,
  readDeletedFood,
  readLineFoods,
  readMergeUndo,
  recordAIChange,
  refreshAIFlag,
  restoreDeletedFood,
  restoreName,
  restoreSpelling,
  settleAIChange,
  takeOpenParentChanges,
  wasDeletionUndone,
  wasMergeUndone,
  wasParentUndone,
  wasSpellingUndone,
} from "@norish/db/repositories/ingredient-ai-changes";
import { findLocaleNames } from "@norish/db/repositories/ingredient-aliases";
import {
  deleteCatalogueAlias,
  deleteCatalogueIngredient,
  findCatalogueAliasOwner,
  isAskableByAI,
  keepIngredientDistinct,
  renameToPlainName,
} from "@norish/db/repositories/ingredient-catalogue";
import { findRowsNamingSpellings } from "@norish/db/repositories/ingredient-cleanup";
import { addToJunkPile, takeOffJunkPile } from "@norish/db/repositories/ingredient-junk-pile";
import {
  closesCycle,
  countAliasesOf,
  findIngredientAncestors,
  insertCatalogueIngredient,
  lockFoods,
  lockIngredients,
  lockTree,
  mergeCatalogueIngredients,
  moveCatalogueAlias,
  setCatalogueIngredientParent,
  splitCatalogueIngredient,
} from "@norish/db/repositories/ingredient-relocation";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { distinctFoods } from "@norish/shared/lib/line-foods";

import type { CatalogueActor, CatalogueEdit } from "./catalogue";
import {
  CatalogueEditError,
  inEdit,
  mayEditOwnedRow,
  moveToFoodNamedFor,
  refusedOn,
} from "./catalogue";
import { ingredientChanges } from "./changes";
import { announceMinted } from "./minted";
import { resolveAgain } from "./resolve-again";
import { forgetSpellingRules } from "./resolver";

/** Shared through `globalThis`, as the held mints are, so a module copied into two chunks still sees it. */
const OVERRIDING_KEY = Symbol.for("norish:ingredients-overriding");
const g = globalThis as { [OVERRIDING_KEY]?: AsyncLocalStorage<true> };
const overriding = (g[OVERRIDING_KEY] ??= new AsyncLocalStorage<true>());

/** Run a whole-catalogue Clean up's work: a person's decisions and remembered undos are not read. */
export function overridingDecisions<T>(run: () => Promise<T>): Promise<T> {
  return overriding.run(true, run);
}

/** Whether the work running overrides a person's decisions and undos (`overridingDecisions`). */
export function isOverriding(): boolean {
  return overriding.getStore() === true;
}

/** Applying AI's answer: made, undone by a person before, decided by a person meanwhile, or a food gone. */
export type ApplyOutcome = "applied" | "undone" | "decided" | "gone";

/** An outcome that changed nothing, reported as skipped; a food gone is not found. */
export function skippedBy<R extends string>(outcome: R | "gone") {
  return { outcome: "skipped", reason: outcome === "gone" ? "not-found" : outcome } as const;
}

async function announceIfApplied<T extends string>(
  outcome: T,
  changed: Array<string | null>
): Promise<T> {
  if (outcome === "applied") {
    await ingredientChanges().changed(changed.filter((id): id is string => id !== null));
  }

  return outcome;
}

/**
 * Take the tree lock, then the foods' rows: "gone" where one of `ids` went, "decided" where a person
 * decided about the first meanwhile, else null.
 */
async function lockForAI(tx: DbTransaction, ids: readonly string[]) {
  if (!(await lockFoods(tx, ids))) return "gone";
  if (!isOverriding() && !(await isAskableByAI(tx, ids[0]!))) return "decided";

  return null;
}

/** Merge `sourceId` into `targetId`, keeping the target's own flag; an unsure merge flags it. */
export async function mergeByAI(sourceId: string, targetId: string, sure: boolean) {
  const outcome = await withTransaction(async (tx): Promise<ApplyOutcome> => {
    const locked = await lockForAI(tx, [sourceId, targetId]);

    if (locked) return locked;
    const undo = await readMergeUndo(tx, sourceId);

    if (!undo) return "gone";
    if (!isOverriding() && (await wasMergeUndone(tx, targetId, undo.aliasIds))) return "undone";
    await mergeCatalogueIngredients(tx, sourceId, targetId, { keepFlag: true });
    await recordAIChange(tx, { ingredientId: targetId, sure, undo });
    if (!sure) await flagUnderOpenChange(tx, targetId);

    return "applied";
  });

  return await announceIfApplied(outcome, [sourceId, targetId]);
}

/**
 * File a food under `parentId`, or none (null), leaving it unchosen; `previous` is the parent it had.
 * Undo goes back to where the oldest open parent change it replaces found it; a drop's, to `previous`.
 */
export async function parentByAI(ingredientId: string, parentId: string | null, sure: boolean) {
  let previous: string | null = null;
  const ids = parentId ? [ingredientId, parentId] : [ingredientId];
  const outcome = await withTransaction(async (tx): Promise<ApplyOutcome | "cycle"> => {
    const locked = await lockForAI(tx, ids);

    if (locked) return locked;
    if (!isOverriding() && (await wasParentUndone(tx, ingredientId, parentId))) return "undone";

    if (parentId && (await closesCycle(tx, ingredientId, parentId))) return "cycle";
    previous = (await findIngredientAncestors([ingredientId], tx)).get(ingredientId)?.[0] ?? null;
    const replaced = await takeOpenParentChanges(tx, ingredientId);
    const undoTo = parentId !== null && replaced ? replaced.formerParentId : previous;

    if (previous !== parentId) {
      await setCatalogueIngredientParent(tx, ingredientId, parentId, { byAI: true });
    }
    if (previous !== parentId || replaced) {
      await recordAIChange(tx, {
        ingredientId,
        targetId: parentId,
        sure,
        undo: { kind: "parent", formerParentId: undoTo },
      });
    }
    await refreshAIFlag(tx, ingredientId, { unsure: !sure });

    return "applied";
  });

  return {
    outcome: await announceIfApplied(outcome, [ingredientId, previous, parentId]),
    previous,
  };
}

/** Rename a food to its Plain Name and settle it; "settled" where settled or taken meanwhile. */
export async function renameByAI(ingredientId: string, formerName: string, name: string) {
  const outcome = await withTransaction(async (tx): Promise<ApplyOutcome | "settled"> => {
    const locked = await lockForAI(tx, [ingredientId]);

    if (locked) return locked;
    if (!(await renameToPlainName(tx, ingredientId, name, { evenSettled: isOverriding() }))) {
      return "settled";
    }
    await recordAIChange(tx, {
      ingredientId,
      sure: true,
      undo: { kind: "plain-name", formerName, name },
    });

    return "applied";
  });

  return await announceIfApplied(outcome, [ingredientId]);
}

/**
 * Split a food into the foods its parts resolved to, and delete it; a part spelled by the food
 * moves that spelling to the food named for it. Not an AI Change: a split grocery has no Undo.
 */
export async function splitByAI(
  ingredientId: string,
  parts: readonly [SplitPart, ...SplitPart[]],
  joined: LineJoin
) {
  const ids = [...new Set([ingredientId, ...parts.map((part) => part.ingredientId)])];
  const { outcome, movedTo } = await withTransaction(async (tx) => {
    const none = (outcome: ApplyOutcome | "refused") => ({ outcome, movedTo: null });

    const locked = await lockForAI(tx, ids);

    if (locked) return none(locked);
    const spelledByFood = parts.find((part) => part.ingredientId === ingredientId);
    let movedTo: { id: string; minted: boolean } | null = null;

    if (spelledByFood) {
      const alias = await findCatalogueAliasOwner(tx, spelledByFood.aliasId);

      if (alias?.ingredientId !== ingredientId) return none("gone");
      movedTo = await moveToFoodNamedFor(
        tx,
        { id: spelledByFood.aliasId, text: alias.text },
        { ownerId: alias.ownerId }
      );
      // The food is itself named for the spelling: a split would delete it with the spelling on it.
      if (movedTo.id === ingredientId) return none("refused");
    }
    const [first, ...rest] = distinctFoods(
      parts.map((part) =>
        part === spelledByFood && movedTo ? { ...part, ingredientId: movedTo.id } : part
      )
    );

    await splitCatalogueIngredient(tx, ingredientId, [first!, ...rest], joined);

    return { outcome: "applied" as const, movedTo };
  });

  if (outcome !== "refused") await announceIfApplied(outcome, [...ids, movedTo?.id ?? null]);
  if (outcome === "applied" && movedTo?.minted) await announceMinted([movedTo.id]);

  return outcome;
}

/**
 * Delete a food AI says is not a food, its rows keeping their text and its spellings piled; one a
 * Pantry Ingredient names is kept flagged, and one whose deletion a person undid is kept.
 */
export async function deleteByAI(ingredientId: string): Promise<ApplyOutcome | "kept"> {
  let piled = 0;
  const outcome = await withTransaction(async (tx): Promise<ApplyOutcome | "kept"> => {
    const locked = await lockForAI(tx, [ingredientId]);

    if (locked) return locked;
    const food = await readDeletedFood(tx, ingredientId);

    if (!food) return "gone";
    if (!isOverriding() && (await wasDeletionUndone(tx, ingredientId))) return "undone";
    if (await isInAnyPantry(tx, ingredientId)) {
      await refreshAIFlag(tx, ingredientId, { unsure: true, reason: "ai-junk" });

      return "kept";
    }
    const aiChangeId = await recordAIChange(tx, {
      sure: true,
      undo: { kind: "not-a-food", food },
    });

    await deleteCatalogueIngredient(tx, ingredientId);
    piled = await addToJunkPile(
      tx,
      food.aliases.map((alias) => alias.fold),
      { reason: "not-a-food", aiChangeId }
    );

    return "applied";
  });

  if (piled > 0) forgetSpellingRules();
  if (outcome === "applied" || outcome === "kept") {
    await ingredientChanges().changed([ingredientId]);
  }

  return outcome;
}

/** What a spelling AI's answer would take off or move came to. */
export type SpellingOutcome = ApplyOutcome | "seeded" | "last-spelling";

/**
 * The spelling the food holds that the seed did not give it, locked with the food (and `targetId`);
 * an outcome instead where it went, is seeded, was undone or is the food's last.
 */
async function lockAddedSpelling(
  tx: DbTransaction,
  ingredientId: string,
  aliasId: string,
  targetId: string | null = null
) {
  const ids = targetId ? [ingredientId, targetId] : [ingredientId];

  if (!(await lockFoods(tx, ids))) return "gone";
  const read = await readChangedSpelling(tx, aliasId);

  if (!read || read.ingredientId !== ingredientId) return "gone";
  if (read.seeded) return "seeded";
  if (!isOverriding() && (await wasSpellingUndone(tx, aliasId))) return "undone";
  if ((await countAliasesOf(tx, ingredientId)) <= 1) return "last-spelling";
  const { ingredientId: _on, seeded: _seeded, ...spelling } = read;

  return spelling;
}

/**
 * Take a spelling AI says does not name its food off it, onto the junk pile where it names no
 * food; its rows are read again from their text, a mint followed by AI's pass.
 */
export async function removeSpellingByAI(
  ingredientId: string,
  aliasId: string,
  { notAFood }: { notAFood: boolean }
): Promise<SpellingOutcome> {
  const done = await withTransaction(async (tx) => {
    const spelling = await lockAddedSpelling(tx, ingredientId, aliasId);

    if (typeof spelling === "string") return spelling;
    const rows = await findRowsNamingSpellings(tx, [aliasId]);
    const aiChangeId = await recordAIChange(tx, {
      ingredientId,
      sure: true,
      undo: {
        kind: "spelling",
        spelling,
        lines: await readLineFoods(
          tx,
          rows.lines.map((line) => line.id)
        ),
        groceries: rows.groceries.map((row) => row.id),
        recurring: rows.recurring.map((row) => row.id),
      },
    });

    await deleteCatalogueAlias(tx, aliasId);
    const piled = notAFood
      ? await addToJunkPile(tx, [spelling.fold], { reason: "not-a-food", aiChangeId })
      : 0;

    return { rows, aiChangeId, piled };
  });

  if (typeof done === "string") return done;
  if (done.piled > 0) forgetSpellingRules();
  await resolveAgain(done.rows, "person");
  await noteSpellingRemovalLeft(done.aiChangeId);

  return await announceIfApplied("applied", [ingredientId]);
}

/** Move a spelling AI says names another food to that food; its rows follow. */
export async function moveSpellingByAI(
  ingredientId: string,
  aliasId: string,
  targetId: string
): Promise<SpellingOutcome> {
  const outcome = await withTransaction(async (tx): Promise<SpellingOutcome> => {
    const spelling = await lockAddedSpelling(tx, ingredientId, aliasId, targetId);

    if (typeof spelling === "string") return spelling;
    await recordAIChange(tx, {
      ingredientId,
      targetId,
      sure: true,
      undo: { kind: "spelling", spelling, lines: [], groceries: [], recurring: [] },
    });
    await moveCatalogueAlias(tx, aliasId, targetId);

    return "applied";
  });

  return await announceIfApplied(outcome, [ingredientId, targetId]);
}

/** Flag a food AI answered about without changing it, unless the answer was sure or a person decided meanwhile. */
export async function flagByAnswer(
  ingredientId: string,
  sure: boolean,
  reason: FlagReason = "ai-unsure"
): Promise<void> {
  const flagged = await withTransaction(async (tx) => {
    if (await lockForAI(tx, [ingredientId])) return false;
    await refreshAIFlag(tx, ingredientId, { unsure: !sure, reason });

    return true;
  });

  if (flagged) await ingredientChanges().changed([ingredientId]);
}

/** One AI Change as Changed by AI shows it, and whether the viewer may keep or undo it. */
export interface AIChangeItem {
  id: string;
  kind: AIChangeKind;
  sure: boolean;
  kept: boolean;
  createdAt: Date;
  /** The food it is listed under: a merge's is the food the other joined; none for a deleted one. */
  ingredient: NamedFood | null;
  /** A parent's parent. */
  target: NamedFood | null;
  /** The parent a change to no parent took away. */
  dropped: NamedFood | null;
  /** The merged or deleted food's name, or the name AI replaced. */
  from: string | null;
  canAct: boolean;
}

/** Whose food a change is (a merge's: the food merged away), and what it was before. */
function subjectOf(change: StoredAIChange) {
  const { undo } = change;

  switch (undo.kind) {
    case "merge":
      return { ownerId: undo.ownerId, from: undo.name };
    case "parent":
      return { ownerId: change.ingredient?.ownerId ?? null, from: null };
    case "plain-name":
      return { ownerId: change.ingredient?.ownerId ?? null, from: undo.formerName };
    case "not-a-food":
      return { ownerId: undo.food.ownerId, from: undo.food.name };
    case "spelling":
      return { ownerId: change.ingredient?.ownerId ?? null, from: undo.spelling.text };
  }
}

/** Whether `actor` may act on a change, by the ingredient policy on its food. */
async function mayActOn(actor: CatalogueActor, change: StoredAIChange): Promise<boolean> {
  const { edit } = await getIngredientPermissionPolicy();

  return mayEditOwnedRow(edit, actor, subjectOf(change).ownerId);
}

/** Everything Changed by AI lists, each saying whether the viewer may act on it. */
export async function listAIChangesFor(actor: CatalogueActor): Promise<AIChangeItem[]> {
  const [{ edit }, changes] = await Promise.all([getIngredientPermissionPolicy(), listAIChanges()]);
  const names = await findLocaleNames(
    changes.flatMap((change) =>
      [change.ingredient?.id, change.target?.id, change.dropped?.id].filter(
        (id) => id !== undefined
      )
    )
  );
  const named = (food: { id: string; name: string }): NamedFood => ({
    id: food.id,
    name: food.name,
    localeNames: names.get(food.id) ?? {},
  });

  return changes.map((change) => {
    const { ownerId, from } = subjectOf(change);

    return {
      id: change.id,
      kind: change.undo.kind,
      sure: change.sure,
      kept: change.kept,
      createdAt: change.createdAt,
      ingredient: change.ingredient ? named(change.ingredient) : null,
      target: change.target ? named(change.target) : null,
      dropped: change.dropped ? named(change.dropped) : null,
      from,
      canAct: mayEditOwnedRow(edit, actor, ownerId),
    };
  });
}

/** The change, locked after the tree lock as every catalogue edit takes them, if the actor may act on it. */
async function lockChangeFor(tx: DbTransaction, actor: CatalogueActor, changeId: string) {
  await lockTree(tx);
  const change = await lockAIChange(tx, changeId);

  if (!change) throw new CatalogueEditError("not-found");
  if (!(await mayActOn(actor, change))) throw new CatalogueEditError("forbidden");

  return change;
}

/**
 * Keep an unsure change, lifting the flag it raised. Kept parents and names are the person's
 * decision about the food, so AI asks about it no more.
 */
export async function keepAIChange(
  actor: CatalogueActor,
  changeId: string
): Promise<CatalogueEdit> {
  return await inEdit(async (tx) => {
    const change = await lockChangeFor(tx, actor, changeId);
    const foodId = change.ingredient?.id;

    if (change.sure || change.kept || !foodId) return { changed: [] };
    await settleAIChange(tx, changeId, "kept");
    if (change.undo.kind === "merge") {
      await clearAIFlagUnlessOpen(tx, foodId);
    } else {
      await keepIngredientDistinct(tx, foodId);
      await refreshAIFlag(tx, foodId, { unsure: false });
    }

    return { changed: [foodId] };
  });
}

/** Undo a change as far as the food is still as AI left it, and remember it so AI never repeats it. */
export async function undoAIChange(
  actor: CatalogueActor,
  changeId: string
): Promise<CatalogueEdit> {
  const { piled, ...edit } = await inEdit(async (tx) => {
    const change = await lockChangeFor(tx, actor, changeId);
    const foodId = change.ingredient?.id;
    const changed = await reverseChange(tx, change);
    // An Undo says the text names a food, so it leaves the pile whoever put it there.
    const piled = await takeOffJunkPile(tx, removedFolds(change));

    await settleAIChange(tx, changeId, "undone");
    // A sure change raised no flag, so undoing it lifts none.
    if (!change.sure && foodId) await clearAIFlagUnlessOpen(tx, foodId);

    return { changed: foodId ? [foodId, ...changed] : changed, piled };
  });

  if (piled > 0) forgetSpellingRules();

  return edit;
}

/** The folds a change took out of the catalogue: a deleted food's spellings, or a removed one. */
function removedFolds({ undo, target }: StoredAIChange): string[] {
  if (undo.kind === "not-a-food") return undo.food.aliases.map((alias) => alias.fold);

  return undo.kind === "spelling" && !target ? [undo.spelling.fold] : [];
}

/** Put back what one change took, through `tx`; returns the other foods it touched. */
async function reverseChange(tx: DbTransaction, change: StoredAIChange): Promise<string[]> {
  const { undo } = change;

  if (undo.kind === "not-a-food") {
    const restored = await refusedOn("name-taken", () => restoreDeletedFood(tx, undo.food));

    if (!restored) throw new CatalogueEditError("spelling-taken");

    return [undo.food.ingredientId];
  }

  const foodId = change.ingredient?.id;

  if (!foodId) return [];
  await lockIngredients(tx, [foodId]);

  switch (undo.kind) {
    case "merge": {
      const stillJoined = await aliasesStillOn(tx, foodId, undo.aliasIds);

      if (stillJoined.length === 0) return [];
      const restored = await refusedOn("name-taken", () =>
        insertCatalogueIngredient(tx, { name: undo.name, ownerId: undo.ownerId })
      );

      for (const aliasId of stillJoined) await moveCatalogueAlias(tx, aliasId, restored);
      if (undo.parentId && (await lockIngredients(tx, [undo.parentId])) > 0) {
        await setCatalogueIngredientParent(tx, restored, undo.parentId, { byAI: true });
      }

      return [restored];
    }
    case "parent": {
      const [parent = null] = (await findIngredientAncestors([foodId], tx)).get(foodId) ?? [];
      const targetId = change.target?.id ?? null;

      // A parent a person set since is theirs to keep.
      if (parent !== targetId) return [];
      const former = undo.formerParentId;
      const formerFits =
        former !== null &&
        (await lockIngredients(tx, [former])) > 0 &&
        !(await closesCycle(tx, foodId, former));

      await setCatalogueIngredientParent(tx, foodId, formerFits ? former : null, { byAI: true });

      return [targetId, formerFits ? former : null].filter((id) => id !== null);
    }
    case "plain-name":
      await restoreName(tx, foodId, undo);

      return [];
    case "spelling": {
      const movedTo = change.target?.id;

      if (!movedTo) {
        const mint = await findMintHolding(tx, undo.spelling.fold, change.createdAt);

        // The removal's rows minted its text again: that food goes back into this one.
        if (mint) await mergeCatalogueIngredients(tx, mint, foodId);
        if (!(await restoreSpelling(tx, foodId, undo))) {
          throw new CatalogueEditError("spelling-taken");
        }

        return mint ? [mint] : [];
      }
      const alias = await findCatalogueAliasOwner(tx, undo.spelling.id);

      // A spelling moved on since, or the moved-to food's last, stays.
      if (alias?.ingredientId !== movedTo || (await lockIngredients(tx, [movedTo])) < 1) return [];
      if ((await countAliasesOf(tx, movedTo)) <= 1) return [];
      await moveCatalogueAlias(tx, undo.spelling.id, foodId);

      return [movedTo];
    }
  }
}
