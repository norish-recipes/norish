/**
 * A person's catalogue edits (ADR-0037), each one transaction under the ingredient permission
 * policy: adding an alias is open, the rest needs `edit`, a seeded row is an admin's.
 */
import type { PermissionLevel } from "@norish/config/zod/server-config";
import type { DbTransaction } from "@norish/db/drizzle";
import type {
  CatalogueAlias,
  CatalogueIngredient,
  CatalogueOwner,
} from "@norish/db/repositories/ingredient-catalogue";
import type { CatalogueRefusal, FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames, NamedFood } from "@norish/shared/lib/ingredient-names";
import type {
  IngredientSearchField,
  IngredientSearchMatch,
} from "@norish/shared/lib/ingredient-search";
import { withTransaction } from "@norish/db/drizzle";
import { isConstraintViolation } from "@norish/db/repositories/constraint-violation";
import { keepOpenAIChangesOf } from "@norish/db/repositories/ingredient-ai-changes";
import { findLocaleNames } from "@norish/db/repositories/ingredient-aliases";
import {
  deleteCatalogueAlias,
  deleteCatalogueIngredient,
  findCatalogueAliasOwner,
  findCatalogueIngredientOwner,
  findIngredientIdByFold,
  insertCatalogueAlias,
  keepIngredientDistinct,
  listCatalogueAliasesOf,
  listCatalogueIngredients,
  renameCatalogueIngredient,
  sweepUnusedCatalogueIngredients,
} from "@norish/db/repositories/ingredient-catalogue";
import { findRowsNamingFood } from "@norish/db/repositories/ingredient-cleanup";
import { setIngredientIcon } from "@norish/db/repositories/ingredient-icons";
import { addToJunkPile, takeOffJunkPile } from "@norish/db/repositories/ingredient-junk-pile";
import {
  closesCycle,
  countAliasesOf,
  findIngredientAncestors,
  insertCatalogueIngredient,
  lockFoods,
  lockIngredientNamed,
  lockIngredients,
  lockTree,
  mergeCatalogueIngredients,
  moveCatalogueAlias,
  setCatalogueIngredientParent,
} from "@norish/db/repositories/ingredient-relocation";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { claimOwnIcon } from "@norish/shared-server/media/ingredient-icon";
import { isFlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import { viewerAndHouseholdIds } from "@norish/shared/lib/household";
import { catalogueLanguagesFor, chooseLocaleNames } from "@norish/shared/lib/ingredient-names";
import { parseIngredientSearch } from "@norish/shared/lib/ingredient-search";
import { cleanSpelling, ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { IngredientIcon } from "./icons";
import { ingredientChanges } from "./changes";
import { ingredientIcons } from "./icons";
import { resolveAgain } from "./resolve-again";
import { cleanIngredientText, forgetSpellingRules } from "./resolver";

/** Who is editing: what the policy is asked about. */
export interface CatalogueActor {
  userId: string;
  householdUserIds: readonly string[] | null;
  isServerAdmin: boolean;
}

export type { CatalogueRefusal };

export class CatalogueEditError extends Error {
  constructor(readonly refusal: CatalogueRefusal) {
    super(`Ingredient edit refused: ${refusal}`);
    this.name = "CatalogueEditError";
  }
}

/**
 * Whether `actor` may edit a row owned by `ownerId` under `level`. Pure, so
 * a page of rows is judged against one read of the policy.
 */
export function mayEditOwnedRow(
  level: PermissionLevel,
  actor: CatalogueActor,
  ownerId: string | null
): boolean {
  if (actor.isServerAdmin) return true;
  if (ownerId === null) return false;
  if (ownerId === actor.userId) return true;

  switch (level) {
    case "everyone":
      return true;
    case "household":
      return viewerAndHouseholdIds(actor).includes(ownerId);
    default:
      return false;
  }
}

/** One spelling as the page shows it, and whether the viewer may remove or move it. */
export interface IngredientSpelling {
  id: string;
  text: string;
  locale: string | null;
  seeded: boolean;
  canRemove: boolean;
}

/** One Ingredient as the page shows it: what it is, and what the viewer may do to it. */
export interface IngredientListItem {
  id: string;
  name: string;
  /** The best spelling per language, for showing the Ingredient in the viewer's. */
  localeNames: LocaleNames;
  flagged: boolean;
  /** Why it is flagged, where the catalogue recorded one. */
  flagReason: FlagReason | null;
  parent: NamedFood | null;
  /** How many Ingredients are kinds of this one, for the fold on the page. */
  kinds: number;
  /** The Ingredient Icon it shows (its own, shipped or borrowed), by address; null shows the placeholder. */
  icon: string | null;
  /** Whether the icon is the food's own, which is the one a person may remove. */
  ownIcon: boolean;
  canEdit: boolean;
  /**
   * The spellings in the viewer's language, language-free or a person's own (all, for a food known
   * only in others); the rest are `hiddenSpellings`, listed by `listSpellings`.
   */
  aliases: IngredientSpelling[];
  hiddenSpellings: number;
}

export const INGREDIENT_PAGE_SIZE = 50;

/**
 * A page of the catalogue (all, flagged, or what a search finds in the fields it asks for), each
 * row saying what the viewer may do; `locale` picks the spellings shown.
 */
export async function listIngredients(
  actor: CatalogueActor,
  query: {
    search?: string;
    match?: IngredientSearchMatch;
    fields?: IngredientSearchField[];
    flaggedOnly?: boolean;
    /** Only the Ingredients filed under this one (null: under none), for the page's tree. */
    parentId?: string | null;
    /** Only the Ingredients with neither a parent nor kinds. */
    standaloneOnly?: boolean;
    /** Only this Ingredient. */
    id?: string;
    /** Only the foods the Ingredients page lists: no grocery food, no own food nothing names. */
    listedOnly?: boolean;
    offset?: number;
    locale?: string;
  }
): Promise<{ items: IngredientListItem[]; nextOffset: number | null }> {
  const search = query.search?.trim() ?? "";
  const offset = query.offset ?? 0;
  const languages = catalogueLanguagesFor(query.locale ?? "en");
  const [policy, rows] = await Promise.all([
    getIngredientPermissionPolicy(),
    listCatalogueIngredients({
      search: parseIngredientSearch(search, { match: query.match, fields: query.fields }),
      flaggedOnly: query.flaggedOnly ?? false,
      parentId: query.parentId,
      standaloneOnly: query.standaloneOnly ?? false,
      id: query.id,
      listedOnly: query.listedOnly,
      // One more than a page says whether there is a next one.
      limit: INGREDIENT_PAGE_SIZE + 1,
      offset,
    }),
  ]);
  const may = (ownerId: string | null) => mayEditOwnedRow(policy.edit, actor, ownerId);
  const page = rows.slice(0, INGREDIENT_PAGE_SIZE);
  const [parentNames, icons] = await Promise.all([
    findLocaleNames(page.flatMap((row) => (row.parent ? [row.parent.id] : []))),
    ingredientIcons(page.map((row) => row.id)),
  ]);

  return {
    items: page.map((row) =>
      listItem(row, may, parentNames, languages, icons.get(row.id) ?? { address: null, own: false })
    ),
    nextOffset: rows.length > INGREDIENT_PAGE_SIZE ? offset + INGREDIENT_PAGE_SIZE : null,
  };
}

/** Every spelling of one Ingredient, for the row that asked for more than the viewer's. */
export async function listSpellings(
  actor: CatalogueActor,
  ingredientId: string
): Promise<IngredientSpelling[]> {
  const [policy, aliases] = await Promise.all([
    getIngredientPermissionPolicy(),
    listCatalogueAliasesOf(ingredientId),
  ]);

  return aliases.map((alias) =>
    spelling(alias, (ownerId) => mayEditOwnedRow(policy.edit, actor, ownerId))
  );
}

function spelling(
  alias: CatalogueAlias,
  may: (ownerId: string | null) => boolean
): IngredientSpelling {
  return {
    id: alias.id,
    text: alias.text,
    locale: alias.locale ?? null,
    seeded: alias.seeded ?? false,
    canRemove: may(alias.ownerId),
  };
}

function listItem(
  row: CatalogueIngredient,
  may: (ownerId: string | null) => boolean,
  parentNames: ReadonlyMap<string, LocaleNames>,
  languages: readonly string[],
  icon: IngredientIcon
): IngredientListItem {
  const all = row.aliases.map((alias) => spelling(alias, may));
  const own = all.filter(
    (alias) => !alias.seeded || !alias.locale || languages.includes(alias.locale)
  );
  const shown = own.length > 0 ? own : all;

  return {
    id: row.id,
    name: row.name,
    localeNames: chooseLocaleNames(all),
    flagged: row.flagged,
    flagReason: isFlagReason(row.flagReason) ? row.flagReason : null,
    parent: row.parent
      ? { ...row.parent, localeNames: parentNames.get(row.parent.id) ?? {} }
      : null,
    kinds: row.kinds,
    icon: icon.address,
    ownIcon: icon.own,
    canEdit: may(row.ownerId),
    aliases: shown,
    hiddenSpellings: all.length - shown.length,
  };
}

/** What an edit did: the Ingredients it changed, for every screen showing them to refetch. */
export interface CatalogueEdit {
  changed: string[];
}

/**
 * Run an edit in one transaction, so a refusal anywhere undoes it all; once committed, the
 * Ingredients it changed are announced.
 */
export async function inEdit<T extends CatalogueEdit>(
  run: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const edit = await withTransaction(run);

  await ingredientChanges().changed(edit.changed);

  return edit;
}

/** A write the database refused on a unique constraint (`23505`), as this edit's refusal. */
export async function refusedOn<T>(refusal: CatalogueRefusal, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isConstraintViolation(error, "23505")) throw new CatalogueEditError(refusal);
    throw error;
  }
}

/** Refuse unless the row exists and `actor` may edit it, whoever owns it. */
export async function assertMayEdit<T extends CatalogueOwner>(
  actor: CatalogueActor,
  row: T | null
): Promise<T> {
  if (!row) throw new CatalogueEditError("not-found");
  const policy = await getIngredientPermissionPolicy();

  if (!mayEditOwnedRow(policy.edit, actor, row.ownerId)) {
    throw new CatalogueEditError("forbidden");
  }

  return row;
}

async function assertMayEditIngredient(
  tx: DbTransaction,
  actor: CatalogueActor,
  ingredientId: string
): Promise<void> {
  await assertMayEdit(actor, await findCatalogueIngredientOwner(tx, ingredientId));
}

/**
 * Refuse unless the Ingredient is there and `actor` may edit it: the check before uploading or
 * drawing its icon, which Save checks again.
 */
export async function assertMayEditFood(
  actor: CatalogueActor,
  ingredientId: string
): Promise<void> {
  await withTransaction((tx) => assertMayEditIngredient(tx, actor, ingredientId));
}

/**
 * Add a spelling to any Ingredient, seeded too, stored clean (`cleanSpelling`) and taken off the
 * junk pile; one another Ingredient holds is refused, one this Ingredient holds is a no-op.
 */
export async function addAlias(
  actor: CatalogueActor,
  ingredientId: string,
  text: string
): Promise<CatalogueEdit> {
  const { piled, ...edit } = await inEdit((tx) => addAliasIn(tx, actor, ingredientId, text));

  if (piled > 0) forgetSpellingRules();

  return edit;
}

/** A spelling edit, and how many folds it put on or took off the junk pile. */
type PileEdit = CatalogueEdit & { piled: number };

async function addAliasIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  ingredientId: string,
  text: string
): Promise<PileEdit> {
  const cleaned = cleanSpelling(cleanIngredientText(text));

  if (!cleaned) throw new CatalogueEditError("empty");
  if (!(await findCatalogueIngredientOwner(tx, ingredientId))) {
    throw new CatalogueEditError("not-found");
  }

  const fold = ingredientAliasFold(cleaned);
  const alias = await insertCatalogueAlias(tx, {
    ingredientId,
    text: cleaned,
    fold,
    ownerId: actor.userId,
  });

  if (!alias && (await findIngredientIdByFold(tx, fold)) !== ingredientId) {
    throw new CatalogueEditError("spelling-taken");
  }

  return { changed: [ingredientId], piled: await takeOffJunkPile(tx, [fold]) };
}

/**
 * Rename an Ingredient (`edit`), which clears its flag; the clean name becomes a spelling too,
 * unless another Ingredient holds it.
 */
export async function renameIngredient(
  actor: CatalogueActor,
  ingredientId: string,
  name: string
): Promise<CatalogueEdit> {
  return await inEdit((tx) => renameIngredientIn(tx, actor, ingredientId, name));
}

async function renameIngredientIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  ingredientId: string,
  name: string
): Promise<CatalogueEdit> {
  const cleaned = cleanIngredientText(name);

  if (!cleaned) throw new CatalogueEditError("empty");
  await assertMayEditIngredient(tx, actor, ingredientId);

  const renamed = await refusedOn("name-taken", () =>
    renameCatalogueIngredient(tx, ingredientId, cleaned)
  );

  if (!renamed) throw new CatalogueEditError("not-found");
  // Naming the food is looking after it: what AI was unsure of is the person's now.
  await keepOpenAIChangesOf(tx, ingredientId);
  const spelling = cleanSpelling(cleaned);

  if (spelling) {
    await insertCatalogueAlias(tx, {
      ingredientId,
      text: spelling,
      fold: ingredientAliasFold(spelling),
      ownerId: actor.userId,
    });
  }

  return { changed: [ingredientId] };
}

/**
 * Set or clear an Ingredient's parent (`edit` on it alone), which clears its flag and keeps AI's
 * changes; a parent closing a cycle is refused.
 */
export async function setParent(
  actor: CatalogueActor,
  ingredientId: string,
  parentId: string | null
): Promise<CatalogueEdit> {
  return await inEdit((tx) => setParentIn(tx, actor, ingredientId, parentId));
}

async function setParentIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  ingredientId: string,
  parentId: string | null
): Promise<CatalogueEdit> {
  await assertMayEditIngredient(tx, actor, ingredientId);
  const ids = parentId ? [ingredientId, parentId] : [ingredientId];

  if (!(await lockFoods(tx, ids))) throw new CatalogueEditError("not-found");
  if (parentId && (await closesCycle(tx, ingredientId, parentId))) {
    throw new CatalogueEditError("cycle");
  }
  // The parent it leaves and the one it joins each count one kind more or less.
  const [previous] = (await findIngredientAncestors([ingredientId], tx)).get(ingredientId) ?? [];

  await setCatalogueIngredientParent(tx, ingredientId, parentId);
  await keepOpenAIChangesOf(tx, ingredientId);

  return {
    changed: [
      ...new Set([ingredientId, ...(previous ? [previous] : []), ...(parentId ? [parentId] : [])]),
    ],
  };
}

/**
 * Delete an Ingredient and its spellings; follows `edit`. Its lines and Groceries keep their text
 * and are resolved again from it, minting nothing; its Pantry Ingredients go.
 */
export async function deleteIngredient(
  actor: CatalogueActor,
  ingredientId: string
): Promise<CatalogueEdit> {
  const naming = await withTransaction(async (tx) => {
    await assertMayEditIngredient(tx, actor, ingredientId);
    // The tree lock, as for every edit that changes what a row points at:
    // a merge into this Ingredient must not land while it goes.
    if (!(await lockFoods(tx, [ingredientId]))) throw new CatalogueEditError("not-found");
    const rows = await findRowsNamingFood(tx, ingredientId);

    await deleteCatalogueIngredient(tx, ingredientId);

    return rows;
  });

  try {
    await resolveAgain(naming, "repoint");
  } finally {
    // The delete went through either way.
    await ingredientChanges().changed([ingredientId]);
  }

  return { changed: [ingredientId] };
}

/** The nightly sweep: delete own Ingredients nothing has named for 90 days; seeded ones stay. */
export async function sweepUnusedIngredients(): Promise<{ deleted: number }> {
  const deleted = await withTransaction(async (tx) => {
    await lockTree(tx);

    return await sweepUnusedCatalogueIngredients(tx);
  });

  if (deleted.length > 0) await ingredientChanges().changed(deleted);

  return { deleted: deleted.length };
}

/**
 * Mark a Flagged Ingredient distinct (`edit`): its flag goes, AI's changes are kept, and the
 * decision keeps Norish from merging it later.
 */
export async function markDistinct(
  actor: CatalogueActor,
  ingredientId: string
): Promise<CatalogueEdit> {
  return await inEdit(async (tx) => {
    await assertMayEditIngredient(tx, actor, ingredientId);
    if (!(await keepIngredientDistinct(tx, ingredientId))) {
      throw new CatalogueEditError("not-found");
    }
    await keepOpenAIChangesOf(tx, ingredientId);

    return { changed: [ingredientId] };
  });
}

/**
 * Merge `sourceId` into `targetId` (`edit` on both): the source's spellings and their lines mean
 * the target, and the source goes.
 */
export async function mergeIngredients(
  actor: CatalogueActor,
  sourceId: string,
  targetId: string
): Promise<CatalogueEdit> {
  if (sourceId === targetId) throw new CatalogueEditError("same-ingredient");

  return await inEdit(async (tx) => {
    await assertMayEditIngredient(tx, actor, sourceId);
    await assertMayEditIngredient(tx, actor, targetId);
    if (!(await mergeCatalogueIngredients(tx, sourceId, targetId))) {
      throw new CatalogueEditError("not-found");
    }

    return { changed: [sourceId, targetId] };
  });
}

/**
 * Move a spelling (`edit` on it) to another Ingredient, or to a new unflagged one named for it
 * (`targetId` null), never a food's last. Answers the food it now names.
 */
export async function moveAlias(
  actor: CatalogueActor,
  aliasId: string,
  targetId: string | null
): Promise<CatalogueEdit & { ingredientId: string }> {
  return await inEdit(async (tx) => {
    // The tree lock before the alias read, as every move and merge takes it first:
    // the alias is then still where it was read.
    await lockTree(tx);

    const alias = await assertMayEdit(actor, await findCatalogueAliasOwner(tx, aliasId));
    const sourceId = alias.ingredientId;

    if (!(await lockFoods(tx, targetId ? [sourceId, targetId] : [sourceId]))) {
      throw new CatalogueEditError("not-found");
    }
    if (targetId === sourceId) return { ingredientId: sourceId, changed: [sourceId] };
    if ((await countAliasesOf(tx, sourceId)) <= 1) throw new CatalogueEditError("last-alias");
    if (targetId) {
      await moveCatalogueAlias(tx, aliasId, targetId);

      return { ingredientId: targetId, changed: [sourceId, targetId] };
    }

    const to = await refusedOn("name-taken", () =>
      moveToFoodNamedFor(tx, { id: aliasId, text: alias.text }, { ownerId: actor.userId })
    );

    // A person asked for a new food, so another one of that name refuses it.
    if (!to.minted) throw new CatalogueEditError("name-taken");

    return { ingredientId: to.id, changed: [sourceId, to.id] };
  });
}

/** Move a spelling to the food named for it, minted with `values` where no food has that name. */
export async function moveToFoodNamedFor(
  tx: DbTransaction,
  alias: { id: string; text: string },
  values: Omit<Parameters<typeof insertCatalogueIngredient>[1], "name">
): Promise<{ id: string; minted: boolean }> {
  const existing = await lockIngredientNamed(tx, alias.text);
  const food = existing
    ? { id: existing, minted: false }
    : { id: await insertCatalogueIngredient(tx, { name: alias.text, ...values }), minted: true };

  await moveCatalogueAlias(tx, alias.id, food.id);

  return food;
}

/**
 * Remove a spelling (`edit` on it), never a food's last; its rows keep their text and food under
 * another spelling.
 */
export async function removeAlias(actor: CatalogueActor, aliasId: string): Promise<CatalogueEdit> {
  const { piled: _piled, ...edit } = await inEdit((tx) => removeAliasIn(tx, actor, aliasId));

  return edit;
}

async function removeAliasIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  aliasId: string,
  {
    of,
    junk = false,
  }: {
    /** The Ingredient the spelling must belong to, where the caller is editing one. */
    of?: string;
    /** The person says the spelling names no food: its fold goes on the junk pile. */
    junk?: boolean;
  } = {}
): Promise<PileEdit> {
  const alias = await assertMayEdit(actor, await findCatalogueAliasOwner(tx, aliasId));

  if (of !== undefined && alias.ingredientId !== of) throw new CatalogueEditError("not-found");

  // The Ingredient is locked, not only the alias: two members removing its
  // last two spellings at once must not both find a sibling left.
  if ((await lockIngredients(tx, [alias.ingredientId])) < 1) {
    throw new CatalogueEditError("not-found");
  }
  if ((await countAliasesOf(tx, alias.ingredientId)) <= 1) {
    throw new CatalogueEditError("last-alias");
  }
  await deleteCatalogueAlias(tx, aliasId);
  // Folds are unique, so no other food still holds the text.
  const piled = junk ? await addToJunkPile(tx, [alias.fold], { reason: "person" }) : 0;

  return { changed: [alias.ingredientId], piled };
}

/** An Ingredient's draft as the panel holds it until Save: only what differs is sent. */
export interface IngredientDraft {
  name?: string;
  /** The new parent, or null to clear it; omitted leaves it as it is. */
  parentId?: string | null;
  add: readonly string[];
  /** The ids of spellings of this Ingredient to remove. */
  remove: readonly string[];
  /** Of `remove`, those the person says name no food, for the junk pile. */
  junk?: readonly string[];
  /** A stored icon file to make the food's own, or null to remove its own; omitted leaves it. */
  icon?: string | null;
}

/**
 * Save a draft (name, parent, spellings removed, piled where marked, and added, a stored icon) as
 * one edit in one transaction, each under its own rule; a refusal anywhere changes nothing.
 */
export async function saveDraft(
  actor: CatalogueActor,
  ingredientId: string,
  draft: IngredientDraft
): Promise<CatalogueEdit> {
  const { piled, ...edit } = await inEdit(async (tx) => {
    const changed = new Set([ingredientId]);
    let piled = 0;

    if (draft.name !== undefined) await renameIngredientIn(tx, actor, ingredientId, draft.name);
    if (draft.parentId !== undefined) {
      const parented = await setParentIn(tx, actor, ingredientId, draft.parentId);

      for (const id of parented.changed) changed.add(id);
    }
    for (const aliasId of draft.remove) {
      piled += (
        await removeAliasIn(tx, actor, aliasId, {
          of: ingredientId,
          junk: draft.junk?.includes(aliasId),
        })
      ).piled;
    }
    for (const text of draft.add) piled += (await addAliasIn(tx, actor, ingredientId, text)).piled;
    if (draft.icon !== undefined) await setIconIn(tx, actor, ingredientId, draft.icon);

    return { changed: [...changed], piled };
  });

  if (piled > 0) forgetSpellingRules();

  return edit;
}

async function setIconIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  ingredientId: string,
  icon: string | null
): Promise<void> {
  await assertMayEditIngredient(tx, actor, ingredientId);
  if (icon !== null && !(await claimOwnIcon(icon))) throw new CatalogueEditError("not-found");
  if (!(await setIngredientIcon(tx, ingredientId, icon))) throw new CatalogueEditError("not-found");
}
