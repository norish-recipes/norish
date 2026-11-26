/**
 * AI Changes (CONTEXT.md; ADR-0037): AI's answers made and recorded in one transaction, inside the
 * asked food's household and the seed (ADR-0042), kept or undone by that household's members.
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
  undoStaysIn,
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
  findIngredientHouseholds,
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
import { getUserPreferences } from "@norish/db/repositories/users";
import { distinctFoods } from "@norish/shared/lib/line-foods";

import type { CatalogueActor, CatalogueEdit } from "./catalogue";
import {
  CatalogueEditError,
  inEdit,
  mayEditOwnedRow,
  moveToFoodNamedFor,
  refusedOn,
} from "./catalogue";
import { announcingTogether, ingredientChanges } from "./changes";
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
  changed: Array<string | null>,
  householdId: string | null
): Promise<T> {
  if (outcome === "applied" && householdId) {
    await ingredientChanges().changed(
      changed.filter((id): id is string => id !== null),
      householdId
    );
  }

  return outcome;
}

/**
 * Take the tree lock, then the foods' rows: "gone" where one of `ids` went or is neither the first
 * one's household's nor the seed's, "decided" where a person decided about the first meanwhile, else
 * the household AI works in.
 */
async function lockForAI(tx: DbTransaction, ids: readonly string[]) {
  if (!(await lockFoods(tx, ids))) return "gone";
  const households = await findIngredientHouseholds(ids, tx);
  const householdId = households.get(ids[0]!);

  if (!householdId) return "gone";
  for (const id of ids) {
    const other = households.get(id);

    if (other !== null && other !== householdId) return "gone";
  }
  if (!isOverriding() && !(await isAskableByAI(tx, ids[0]!))) return "decided";

  return { householdId };
}

/** Merge `sourceId` into `targetId`, keeping the target's own flag; an unsure merge flags it. */
export async function mergeByAI(sourceId: string, targetId: string, sure: boolean) {
  let householdId: string | null = null;
  const outcome = await withTransaction(async (tx): Promise<ApplyOutcome> => {
    const locked = await lockForAI(tx, [sourceId, targetId]);

    if (typeof locked === "string") return locked;
    householdId = locked.householdId;
    const undo = await readMergeUndo(tx, sourceId);

    if (!undo) return "gone";
    if (!isOverriding() && (await wasMergeUndone(tx, targetId, undo.aliasIds))) return "undone";
    await mergeCatalogueIngredients(tx, sourceId, targetId, { keepFlag: true });
    await recordAIChange(tx, { householdId, ingredientId: targetId, sure, undo });
    if (!sure) await flagUnderOpenChange(tx, targetId);

    return "applied";
  });

  return await announceIfApplied(outcome, [sourceId, targetId], householdId);
}

/**
 * File a food under `parentId`, or none (null), leaving it unchosen; `previous` is the parent it had.
 * Undo goes back to where the oldest open parent change it replaces found it; a drop's, to `previous`.
 */
export async function parentByAI(ingredientId: string, parentId: string | null, sure: boolean) {
  let previous: string | null = null;
  let householdId: string | null = null;
  const ids = parentId ? [ingredientId, parentId] : [ingredientId];
  const outcome = await withTransaction(async (tx): Promise<ApplyOutcome | "cycle"> => {
    const locked = await lockForAI(tx, ids);

    if (typeof locked === "string") return locked;
    householdId = locked.householdId;
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
        householdId,
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
    outcome: await announceIfApplied(outcome, [ingredientId, previous, parentId], householdId),
    previous,
  };
}

/** Rename a food to its Plain Name and settle it; "settled" where settled or taken meanwhile. */
export async function renameByAI(ingredientId: string, formerName: string, name: string) {
  let householdId: string | null = null;
  const outcome = await withTransaction(async (tx): Promise<ApplyOutcome | "settled"> => {
    const locked = await lockForAI(tx, [ingredientId]);

    if (typeof locked === "string") return locked;
    householdId = locked.householdId;
    if (!(await renameToPlainName(tx, ingredientId, name, { evenSettled: isOverriding() }))) {
      return "settled";
    }
    await recordAIChange(tx, {
      householdId,
      ingredientId,
      sure: true,
      undo: { kind: "plain-name", formerName, name },
    });

    return "applied";
  });

  return await announceIfApplied(outcome, [ingredientId], householdId);
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
  let householdId: string | null = null;
  const { outcome, movedTo } = await withTransaction(async (tx) => {
    const none = (outcome: ApplyOutcome | "refused") => ({ outcome, movedTo: null });

    const locked = await lockForAI(tx, ids);

    if (typeof locked === "string") return none(locked);
    householdId = locked.householdId;
    const spelledByFood = parts.find((part) => part.ingredientId === ingredientId);
    let movedTo: { id: string; minted: boolean } | null = null;

    if (spelledByFood) {
      const alias = await findCatalogueAliasOwner(tx, householdId, spelledByFood.aliasId);

      if (alias?.ingredientId !== ingredientId) return none("gone");
      movedTo = await moveToFoodNamedFor(
        tx,
        { id: spelledByFood.aliasId, text: alias.text },
        { householdId, ownerId: alias.ownerId }
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

  if (outcome !== "refused") {
    await announceIfApplied(outcome, [...ids, movedTo?.id ?? null], householdId);
  }
  if (outcome === "applied" && movedTo?.minted) await announceMinted([movedTo.id]);

  return outcome;
}

/**
 * Delete a food AI says is not a food, its rows keeping their text and its spellings piled; one a
 * Pantry Ingredient names is kept flagged, and one whose deletion a person undid is kept.
 */
export async function deleteByAI(ingredientId: string): Promise<ApplyOutcome | "kept"> {
  let piled = 0;
  let householdId: string | null = null;
  const outcome = await withTransaction(async (tx): Promise<ApplyOutcome | "kept"> => {
    const locked = await lockForAI(tx, [ingredientId]);

    if (typeof locked === "string") return locked;
    householdId = locked.householdId;
    const food = await readDeletedFood(tx, ingredientId);

    if (!food) return "gone";
    if (!isOverriding() && (await wasDeletionUndone(tx, ingredientId))) return "undone";
    if (await isInAnyPantry(tx, ingredientId)) {
      await refreshAIFlag(tx, ingredientId, { unsure: true, reason: "ai-junk" });

      return "kept";
    }
    const aiChangeId = await recordAIChange(tx, {
      householdId,
      sure: true,
      undo: { kind: "not-a-food", food },
    });

    await deleteCatalogueIngredient(tx, ingredientId);
    piled = await addToJunkPile(
      tx,
      householdId,
      food.aliases.map((alias) => alias.fold),
      { reason: "not-a-food", aiChangeId }
    );

    return "applied";
  });

  if (piled > 0) forgetSpellingRules();
  if ((outcome === "applied" || outcome === "kept") && householdId) {
    await ingredientChanges().changed([ingredientId], householdId);
  }

  return outcome;
}

/** What a spelling AI's answer would take off or move came to. */
export type SpellingOutcome = ApplyOutcome | "seeded" | "last-spelling";

/**
 * The household's spelling on the food, which the seed did not give it, locked with the food (and
 * `targetId`, the household's or the seed's); an outcome instead where it went, is the seed's, was
 * undone or is the food's last.
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
  const { ingredientId: _on, householdId, ...spelling } = read;

  if (householdId === null) return "seeded";
  const target = targetId ? (await findIngredientHouseholds([targetId], tx)).get(targetId) : null;

  if (target !== null && target !== householdId) return "gone";
  if (!isOverriding() && (await wasSpellingUndone(tx, aliasId))) return "undone";
  if ((await countAliasesOf(tx, ingredientId, householdId)) <= 1) return "last-spelling";

  return { householdId, spelling };
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
    const locked = await lockAddedSpelling(tx, ingredientId, aliasId);

    if (typeof locked === "string") return locked;
    const { householdId, spelling } = locked;
    const rows = await findRowsNamingSpellings(tx, [aliasId]);
    const aiChangeId = await recordAIChange(tx, {
      householdId,
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
      ? await addToJunkPile(tx, householdId, [spelling.fold], {
          reason: "not-a-food",
          aiChangeId,
        })
      : 0;

    return { rows, aiChangeId, piled, householdId };
  });

  if (typeof done === "string") return done;
  if (done.piled > 0) forgetSpellingRules();
  await resolveAgain(done.rows, "person");
  await noteSpellingRemovalLeft(done.aiChangeId);

  return await announceIfApplied("applied", [ingredientId], done.householdId);
}

/** Move a spelling AI says names another food to that food; its rows follow. */
export async function moveSpellingByAI(
  ingredientId: string,
  aliasId: string,
  targetId: string
): Promise<SpellingOutcome> {
  let householdId: string | null = null;
  const outcome = await withTransaction(async (tx): Promise<SpellingOutcome> => {
    const locked = await lockAddedSpelling(tx, ingredientId, aliasId, targetId);

    if (typeof locked === "string") return locked;
    const { spelling } = locked;

    householdId = locked.householdId;
    await recordAIChange(tx, {
      householdId,
      ingredientId,
      targetId,
      sure: true,
      undo: { kind: "spelling", spelling, lines: [], groceries: [], recurring: [] },
    });
    await moveCatalogueAlias(tx, aliasId, targetId);

    return "applied";
  });

  return await announceIfApplied(outcome, [ingredientId, targetId], householdId);
}

/** Flag a food AI answered about without changing it, unless the answer was sure or a person decided meanwhile. */
export async function flagByAnswer(
  ingredientId: string,
  sure: boolean,
  reason: FlagReason = "ai-unsure"
): Promise<void> {
  const householdId = await withTransaction(async (tx) => {
    const locked = await lockForAI(tx, [ingredientId]);

    if (typeof locked === "string") return null;
    await refreshAIFlag(tx, ingredientId, { unsure: !sure, reason });

    return locked.householdId;
  });

  if (householdId) await ingredientChanges().changed([ingredientId], householdId);
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

/** What a change's food was before: a merged or deleted food's name, a spelling, a former name. */
function fromOf({ undo }: StoredAIChange): string | null {
  switch (undo.kind) {
    case "merge":
      return undo.name;
    case "parent":
      return null;
    case "plain-name":
      return undo.formerName;
    case "not-a-food":
      return undo.food.name;
    case "spelling":
      return undo.spelling.text;
  }
}

/**
 * Whether `actor` may act on a change: a member of the household AI changed, never on a stranded
 * one, and only an admin where Keep or Undo would write a seeded food's parent or name.
 */
function mayActOn(actor: CatalogueActor, change: StoredAIChange): boolean {
  if (change.undo.stranded || !mayEditOwnedRow(actor, change.householdId)) return false;

  return actor.isServerAdmin || !writesSeededFood(change);
}

/** A merge or a spelling change writes nothing on a seeded food; a parent or a name does. */
function writesSeededFood({ undo, ingredient }: StoredAIChange): boolean {
  return ingredient?.householdId === null && undo.kind !== "merge" && undo.kind !== "spelling";
}

/**
 * Everything Changed by AI lists to the viewer, each saying whether they may act on it: what was
 * settled before they cleared it is left out.
 */
export async function listAIChangesFor(actor: CatalogueActor): Promise<AIChangeItem[]> {
  const changes = await getUserPreferences(actor.userId).then((prefs) =>
    listAIChanges(actor, prefs.aiChangesClearedAt)
  );
  const names = await findLocaleNames(
    actor.householdId,
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
    return {
      id: change.id,
      kind: change.undo.kind,
      sure: change.sure,
      kept: change.kept,
      createdAt: change.createdAt,
      ingredient: change.ingredient ? named(change.ingredient) : null,
      target: change.target ? named(change.target) : null,
      dropped: change.dropped ? named(change.dropped) : null,
      from: fromOf(change),
      canAct: mayActOn(actor, change),
    };
  });
}

/** The change, locked after the tree lock as every catalogue edit takes them, if the actor may act on it. */
async function lockChangeFor(tx: DbTransaction, actor: CatalogueActor, changeId: string) {
  await lockTree(tx);
  const change = await lockAIChange(tx, actor, changeId);

  if (!change) throw new CatalogueEditError("not-found");
  if (!change.householdId || !mayActOn(actor, change)) throw new CatalogueEditError("forbidden");

  return { ...change, householdId: change.householdId };
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
    const audience = change.householdId;

    if (change.sure || change.kept || !foodId) return { changed: [], audience };
    await settleAIChange(tx, changeId, "kept");
    if (change.undo.kind === "merge") {
      await clearAIFlagUnlessOpen(tx, foodId);
    } else {
      // Keeping a spelling change on a seeded food leaves the seed's mark to an admin's edit.
      if (change.ingredient?.householdId !== null) await keepIngredientDistinct(tx, foodId);
      await refreshAIFlag(tx, foodId, { unsure: false });
    }

    return { changed: [foodId], audience };
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

    // Undo writes only in the actor's catalogue: a change naming another household's rows has none.
    if (!(await undoStaysIn(tx, actor, change))) throw new CatalogueEditError("forbidden");
    const changed = await reverseChange(tx, change);
    // An Undo says the text names a food, so it leaves the household's pile whoever put it there.
    const piled = await takeOffJunkPile(tx, change.householdId, removedFolds(change));

    await settleAIChange(tx, changeId, "undone");
    // A sure change raised no flag, so undoing it lifts none.
    if (!change.sure && foodId) await clearAIFlagUnlessOpen(tx, foodId);

    return {
      changed: foodId ? [foodId, ...changed] : changed,
      audience: change.householdId,
      piled,
    };
  });

  if (piled > 0) forgetSpellingRules();

  return edit;
}

/**
 * Keep all or Undo all: each change on its own, announced as one refetch. One already gone is
 * skipped; the first refused is thrown once the rest are settled.
 */
export async function settleAIChanges(
  actor: CatalogueActor,
  changeIds: readonly string[],
  how: "keep" | "undo"
): Promise<void> {
  const settle = how === "keep" ? keepAIChange : undoAIChange;
  const refusals = await announcingTogether(async () => {
    const refused: CatalogueEditError[] = [];

    // ponytail: one transaction per change, in a single request; move to a job if lists grow slow.
    for (const changeId of changeIds) {
      try {
        await settle(actor, changeId);
      } catch (error) {
        if (!(error instanceof CatalogueEditError)) throw error;
        if (error.refusal !== "not-found") refused.push(error);
      }
    }

    return refused;
  });

  if (refusals[0]) throw refusals[0];
}

/** The folds a change took out of the catalogue: a deleted food's spellings, or a removed one. */
function removedFolds({ undo, target }: StoredAIChange): string[] {
  if (undo.kind === "not-a-food") return undo.food.aliases.map((alias) => alias.fold);

  return undo.kind === "spelling" && !target ? [undo.spelling.fold] : [];
}

/** Put back what one change took in its household, through `tx`; returns the other foods it touched. */
async function reverseChange(
  tx: DbTransaction,
  change: StoredAIChange & { householdId: string }
): Promise<string[]> {
  const { undo, householdId } = change;

  if (undo.kind === "not-a-food") {
    const restored = await refusedOn("name-taken", () =>
      restoreDeletedFood(tx, householdId, undo.food)
    );

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
        insertCatalogueIngredient(tx, { householdId, name: undo.name, ownerId: undo.ownerId })
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
        const mint = await findMintHolding(tx, householdId, undo.spelling.fold, change.createdAt);

        // The removal's rows minted its text again: that food goes back into this one.
        if (mint) await mergeCatalogueIngredients(tx, mint, foodId);
        if (!(await restoreSpelling(tx, householdId, foodId, undo))) {
          throw new CatalogueEditError("spelling-taken");
        }

        return mint ? [mint] : [];
      }
      const alias = await findCatalogueAliasOwner(tx, householdId, undo.spelling.id);

      // A spelling moved on since, or the moved-to food's last, stays.
      if (alias?.ingredientId !== movedTo || (await lockIngredients(tx, [movedTo])) < 1) return [];
      if ((await countAliasesOf(tx, movedTo, householdId)) <= 1) return [];
      await moveCatalogueAlias(tx, undo.spelling.id, foodId);

      return [movedTo];
    }
  }
}
