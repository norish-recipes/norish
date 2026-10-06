/**
 * What a person may do to the catalogue of Ingredients, and doing it
 * (ADR-0037). Every edit checks the instance's ingredient permission policy
 * here, the one place that knows it:
 *
 * - adding an alias is open to everyone;
 * - renaming, re-parenting, marking distinct and deleting follow `edit` on the Ingredient;
 * - merging needs `edit` on both Ingredients;
 * - moving or removing an alias follows `edit` on the alias;
 * - an ownerless (seeded) row is an administrator's alone, and an
 *   administrator bypasses the policy, as for recipes.
 *
 * Renaming, re-parenting or marking a Flagged Ingredient distinct clears its
 * flag: looking after it counts as reviewing it. Re-parenting or marking
 * distinct also settles whatever AI suggested for it, as a merge does by
 * taking the food away.
 *
 * Each edit is one transaction: the owner lookup, the policy check, the
 * locks, the write and the suggestion it settles, all through its `tx`. The
 * repositories answer data; what that means as a refusal is decided here.
 * Every edit announces the Ingredients it changed itself (`changes.ts`).
 */
import type { PermissionLevel } from "@norish/config/zod/server-config";
import type { DbTransaction } from "@norish/db/drizzle";
import type {
  CatalogueAlias,
  CatalogueIngredient,
  CatalogueOwner,
} from "@norish/db/repositories/ingredient-catalogue";
import type { CatalogueRefusal, FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import type {
  IngredientSearchField,
  IngredientSearchMatch,
} from "@norish/shared/lib/ingredient-search";
import { withTransaction } from "@norish/db/drizzle";
import { isConstraintViolation } from "@norish/db/repositories/constraint-violation";
import { findLocaleNames } from "@norish/db/repositories/ingredient-aliases";
import {
  deleteCatalogueAlias,
  deleteCatalogueIngredient,
  findCatalogueAliasOwner,
  findCatalogueIngredientOwner,
  findIngredientIdByFold,
  insertCatalogueAlias,
  isAliasInUse,
  isIngredientInUse,
  keepIngredientDistinct,
  listCatalogueAliasesOf,
  listCatalogueIngredients,
  renameCatalogueIngredient,
} from "@norish/db/repositories/ingredient-catalogue";
import { setIngredientIcon } from "@norish/db/repositories/ingredient-icons";
import {
  countAliasesOf,
  findIngredientAncestors,
  insertCatalogueIngredient,
  lockIngredients,
  lockTree,
  mergeCatalogueIngredients,
  moveCatalogueAlias,
  setCatalogueIngredientParent,
} from "@norish/db/repositories/ingredient-relocation";
import { deleteSuggestionFor } from "@norish/db/repositories/ingredient-suggestions";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { ownIconExists } from "@norish/shared-server/media/ingredient-icon";
import { isFlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import { catalogueLanguagesFor, chooseLocaleNames } from "@norish/shared/lib/ingredient-names";
import { parseIngredientSearch } from "@norish/shared/lib/ingredient-search";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { IngredientIcon } from "./icons";
import { ingredientChanges } from "./changes";
import { ingredientIcons } from "./icons";
import { cleanIngredientText } from "./resolver";

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
export function mayEditIngredientRow(
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
      return actor.householdUserIds?.includes(ownerId) ?? false;
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
  parent: { id: string; name: string; localeNames: LocaleNames } | null;
  /** How many Ingredients are kinds of this one, for the fold on the page. */
  kinds: number;
  /** The Ingredient Icon it shows (its own, shipped or borrowed), by address; null shows the placeholder. */
  icon: string | null;
  /** Whether the icon is the food's own, which is the one a person may remove. */
  ownIcon: boolean;
  canEdit: boolean;
  /**
   * The spellings worth showing the viewer: the ones in their language, the
   * language-free ones and a person's own. A food known only in other
   * languages shows them all. The rest are `hiddenSpellings` many, listed by
   * `listSpellings` on request: the catalogue knows a food in dozens of
   * languages, and a page of every one of them is most of what it sends.
   */
  aliases: IngredientSpelling[];
  hiddenSpellings: number;
}

export const INGREDIENT_PAGE_SIZE = 50;

/**
 * A page of the catalogue: every Ingredient, or the flagged ones, or those a
 * search finds — the text contained in, or exactly, the name, a translation
 * or the parent, whichever fields it asks for — by name. Every row says what
 * the viewer may do, so an action they may not take is never offered. The
 * viewer's `locale` picks which spellings ride along.
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
      // One more than a page says whether there is a next one.
      limit: INGREDIENT_PAGE_SIZE + 1,
      offset,
    }),
  ]);
  const may = (ownerId: string | null) => mayEditIngredientRow(policy.edit, actor, ownerId);
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
    spelling(alias, (ownerId) => mayEditIngredientRow(policy.edit, actor, ownerId))
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
 * Run an edit as one unit: the owner lookup, the lock, the write and the
 * suggestion it settles all read and write through the one `tx`, so a
 * refusal anywhere undoes the whole edit. Once it has committed, the
 * Ingredients it changed are announced.
 */
async function inEdit<T extends CatalogueEdit>(run: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const edit = await withTransaction(run);

  await ingredientChanges().changed(edit.changed);

  return edit;
}

/** A write the database refused on a constraint (`23505` unique, `23503` foreign key), as this edit's refusal. */
async function refusedOn<T>(
  code: "23505" | "23503",
  refusal: CatalogueRefusal,
  write: () => Promise<T>
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isConstraintViolation(error, code)) throw new CatalogueEditError(refusal);
    throw error;
  }
}

/** Refuse unless the row exists and `actor` may edit it, whoever owns it. */
async function assertMayEdit<T extends CatalogueOwner>(
  actor: CatalogueActor,
  row: T | null
): Promise<T> {
  if (!row) throw new CatalogueEditError("not-found");
  const policy = await getIngredientPermissionPolicy();

  if (!mayEditIngredientRow(policy.edit, actor, row.ownerId)) {
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
 * Refuse unless the Ingredient is there and `actor` may edit it: what
 * uploading or generating its icon follows, before the draft that holds it
 * is saved under the same rule.
 */
export async function assertMayEditFood(
  actor: CatalogueActor,
  ingredientId: string
): Promise<void> {
  await withTransaction((tx) => assertMayEditIngredient(tx, actor, ingredientId));
}

/**
 * Add a spelling to any Ingredient, a seeded one included: open to everyone,
 * so a household's own words are understood. A spelling another Ingredient
 * already holds is refused; one this Ingredient holds already is a no-op.
 */
export async function addAlias(
  actor: CatalogueActor,
  ingredientId: string,
  text: string
): Promise<CatalogueEdit> {
  return await inEdit((tx) => addAliasIn(tx, actor, ingredientId, text));
}

async function addAliasIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  ingredientId: string,
  text: string
): Promise<CatalogueEdit> {
  const cleaned = cleanIngredientText(text);

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

  return { changed: [ingredientId] };
}

/**
 * Rename an Ingredient, which clears its flag. Follows `edit` on the
 * Ingredient. The new name becomes one of its spellings too, so a line that
 * says the name resolves here rather than being asked about again; where
 * another Ingredient already holds that spelling, the name alone changes.
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

  const renamed = await refusedOn("23505", "name-taken", () =>
    renameCatalogueIngredient(tx, ingredientId, cleaned)
  );

  if (!renamed) throw new CatalogueEditError("not-found");
  await insertCatalogueAlias(tx, {
    ingredientId,
    text: cleaned,
    fold: ingredientAliasFold(cleaned),
    ownerId: actor.userId,
  });

  return { changed: [ingredientId] };
}

/**
 * Set or clear an Ingredient's Parent Ingredient, which clears its flag and
 * settles what AI suggested for it. Follows `edit` on the Ingredient; the
 * parent is only pointed at, so its own policy is not asked. A parent that
 * would close a cycle is refused.
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
  if (parentId === ingredientId) throw new CatalogueEditError("cycle");
  await lockTree(tx);

  const ids = parentId ? [ingredientId, parentId] : [ingredientId];

  if ((await lockIngredients(tx, ids)) < ids.length) throw new CatalogueEditError("not-found");
  if (
    parentId &&
    (await findIngredientAncestors([parentId], tx)).get(parentId)?.includes(ingredientId)
  ) {
    throw new CatalogueEditError("cycle");
  }
  // The parent it leaves and the one it joins each count one kind more or less.
  const [previous] = (await findIngredientAncestors([ingredientId], tx)).get(ingredientId) ?? [];

  await setCatalogueIngredientParent(tx, ingredientId, parentId);
  await deleteSuggestionFor(ingredientId, tx);

  return {
    changed: [
      ...new Set([ingredientId, ...(previous ? [previous] : []), ...(parentId ? [parentId] : [])]),
    ],
  };
}

/**
 * Delete an Ingredient nothing uses, its spellings with it. Follows `edit` on
 * the Ingredient. One a recipe line, grocery or Pantry Ingredient still
 * points at is refused: merging is how those are given another food.
 */
export async function deleteIngredient(
  actor: CatalogueActor,
  ingredientId: string
): Promise<CatalogueEdit> {
  return await inEdit(async (tx) => {
    await assertMayEditIngredient(tx, actor, ingredientId);
    // The tree lock, as for every edit that changes what a row points at:
    // a merge into this Ingredient must not land while it goes.
    await lockTree(tx);
    if ((await lockIngredients(tx, [ingredientId])) < 1) throw new CatalogueEditError("not-found");
    if (await isIngredientInUse(tx, ingredientId)) {
      throw new CatalogueEditError("ingredient-in-use");
    }
    // Something may have come to point at one of its spellings since the check.
    await refusedOn("23503", "ingredient-in-use", () =>
      deleteCatalogueIngredient(tx, ingredientId)
    );

    return { changed: [ingredientId] };
  });
}

/**
 * Mark a Flagged Ingredient distinct: Norish's doubt was unfounded, and what
 * AI suggested for it is settled. The decision is kept, so Norish never
 * merges it later. Follows `edit`.
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
    await deleteSuggestionFor(ingredientId, tx);

    return { changed: [ingredientId] };
  });
}

/**
 * Merge `sourceId` into `targetId`: every spelling of the source, and every
 * line behind them, now means the target, and the source is gone — which is
 * also what clears its flag and takes its suggestion. Needs `edit` on both.
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
 * Move a spelling to another Ingredient, or to a new one named for it
 * (`targetId` null) — the unmerge. Follows `edit` on the alias; the
 * Ingredient it leaves keeps its flag, and a new one is a person's choice, so
 * it is not flagged. An Ingredient keeps at least one spelling. Answers the
 * Ingredient the spelling now names.
 */
export async function moveAlias(
  actor: CatalogueActor,
  aliasId: string,
  targetId: string | null
): Promise<CatalogueEdit & { ingredientId: string }> {
  return await inEdit(async (tx) => {
    // Every catalogue move and merge takes the tree lock first, so they run
    // one at a time (a nightly seed included) and never deadlock on rows,
    // and the alias read under it is where it still is.
    await lockTree(tx);

    const alias = await assertMayEdit(actor, await findCatalogueAliasOwner(tx, aliasId));
    const sourceId = alias.ingredientId;
    const locked = targetId ? [sourceId, targetId] : [sourceId];

    if ((await lockIngredients(tx, locked)) < locked.length) {
      throw new CatalogueEditError("not-found");
    }
    if (targetId === sourceId) return { ingredientId: sourceId, changed: [sourceId] };
    if ((await countAliasesOf(tx, sourceId)) <= 1) throw new CatalogueEditError("last-alias");

    const to =
      targetId ??
      (await refusedOn("23505", "name-taken", () =>
        insertCatalogueIngredient(tx, { name: alias.text, ownerId: actor.userId })
      ));

    await moveCatalogueAlias(tx, aliasId, to);

    return { ingredientId: to, changed: [sourceId, to] };
  });
}

/**
 * Remove a spelling. Follows `edit` on the alias. An Ingredient keeps at
 * least one, and a spelling something points at stays until it is moved.
 */
export async function removeAlias(actor: CatalogueActor, aliasId: string): Promise<CatalogueEdit> {
  return await inEdit((tx) => removeAliasIn(tx, actor, aliasId));
}

async function removeAliasIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  aliasId: string,
  /** The Ingredient the spelling must belong to, where the caller is editing one. */
  of?: string
): Promise<CatalogueEdit> {
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
  if (await isAliasInUse(tx, aliasId)) throw new CatalogueEditError("alias-in-use");
  // Something may have come to point at it since the check.
  await refusedOn("23503", "alias-in-use", () => deleteCatalogueAlias(tx, aliasId));

  return { changed: [alias.ingredientId] };
}

/** An Ingredient's draft as the panel holds it until Save: only what differs is sent. */
export interface IngredientDraft {
  name?: string;
  /** The new parent, or null to clear it; omitted leaves it as it is. */
  parentId?: string | null;
  add: readonly string[];
  /** The ids of spellings of this Ingredient to remove. */
  remove: readonly string[];
  /** A stored icon file to make the food's own, or null to remove its own; omitted leaves it. */
  icon?: string | null;
}

/**
 * Save an Ingredient's draft as one edit: the rename, the parent, the
 * spellings removed and those added, and its icon, each under its own rule,
 * in one transaction. A refusal anywhere changes nothing. The icon follows
 * `edit` on the Ingredient, and must be a file an upload or a generation
 * stored; removing the food's own brings back what it showed before.
 */
export async function saveDraft(
  actor: CatalogueActor,
  ingredientId: string,
  draft: IngredientDraft
): Promise<CatalogueEdit> {
  return await inEdit(async (tx) => {
    const changed = new Set([ingredientId]);

    if (draft.name !== undefined) await renameIngredientIn(tx, actor, ingredientId, draft.name);
    if (draft.parentId !== undefined) {
      const parented = await setParentIn(tx, actor, ingredientId, draft.parentId);

      for (const id of parented.changed) changed.add(id);
    }
    for (const aliasId of draft.remove) await removeAliasIn(tx, actor, aliasId, ingredientId);
    for (const text of draft.add) await addAliasIn(tx, actor, ingredientId, text);
    if (draft.icon !== undefined) await setIconIn(tx, actor, ingredientId, draft.icon);

    return { changed: [...changed] };
  });
}

async function setIconIn(
  tx: DbTransaction,
  actor: CatalogueActor,
  ingredientId: string,
  icon: string | null
): Promise<void> {
  await assertMayEditIngredient(tx, actor, ingredientId);
  if (icon !== null && !(await ownIconExists(icon))) throw new CatalogueEditError("not-found");
  if (!(await setIngredientIcon(tx, ingredientId, icon))) throw new CatalogueEditError("not-found");
}
