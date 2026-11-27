/**
 * A person's catalogue edits (ADR-0037), each one transaction, in their household's catalogue
 * (ADR-0042): any member edits the household's own rows, a seeded row is an admin's, and a spelling
 * anyone adds to a seeded food is their household's.
 */
import type { DbTransaction } from "@norish/db/drizzle";
import type {
  CatalogueAlias,
  CatalogueIngredient,
  CatalogueOwner,
} from "@norish/db/repositories/ingredient-catalogue";
import type { RecipeListContext } from "@norish/db/repositories/recipes";
import type { CatalogueRefusal, FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames, NamedFood } from "@norish/shared/lib/ingredient-names";
import type {
  IngredientSearchField,
  IngredientSearchMatch,
} from "@norish/shared/lib/ingredient-search";
import { withTransaction } from "@norish/db/drizzle";
import { isConstraintViolation } from "@norish/db/repositories/constraint-violation";
import { editableHouseholds } from "@norish/db/repositories/household-scope";
import { keepOpenAIChangesOf } from "@norish/db/repositories/ingredient-ai-changes";
import { findLocaleNames } from "@norish/db/repositories/ingredient-aliases";
import {
  addSpellingUnlessKnown,
  deleteCatalogueAlias,
  deleteCatalogueIngredient,
  findCatalogueAliasOwner,
  findCatalogueIngredientOwner,
  findIngredientIdByFold,
  forEachCatalogue,
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
  fitsInCatalogueOf,
  insertCatalogueIngredient,
  lockFoods,
  lockIngredientNamed,
  lockIngredients,
  lockTree,
  mergeCatalogueIngredients,
  moveCatalogueAlias,
  setCatalogueIngredientParent,
} from "@norish/db/repositories/ingredient-relocation";
import { claimOwnIcon } from "@norish/shared-server/media/ingredient-icon";
import { isFlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import { catalogueLanguagesFor, chooseLocaleNames } from "@norish/shared/lib/ingredient-names";
import { parseIngredientSearch } from "@norish/shared/lib/ingredient-search";
import { cleanSpelling, ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { IngredientIcon } from "./icons";
import { ingredientChanges } from "./changes";
import { ingredientIcons } from "./icons";
import { resolveAgain } from "./resolve-again";
import { cleanIngredientText, forgetSpellingRules } from "./resolver";

/** Who is editing: a member of `householdId`; an admin also edits seeded rows. */
export interface CatalogueActor extends RecipeListContext {
  isServerAdmin: boolean;
}

export type { CatalogueRefusal };

export class CatalogueEditError extends Error {
  constructor(readonly refusal: CatalogueRefusal) {
    super(`Ingredient edit refused: ${refusal}`);
    this.name = "CatalogueEditError";
  }
}

/** Whether `actor` may edit a row of `householdId` (`editableHouseholds`). */
export function mayEditOwnedRow(actor: CatalogueActor, householdId: string | null): boolean {
  return editableHouseholds(actor).includes(householdId);
}

/** Who hears of an edit to a food of `householdId`: its household, or everyone for an admin's seed edit. */
function audienceOf(actor: CatalogueActor, householdId: string | null): string | null {
  return householdId ?? (mayEditOwnedRow(actor, null) ? null : actor.householdId);
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
  const rows = await listCatalogueIngredients({
    householdId: actor.householdId,
    search: parseIngredientSearch(search, { match: query.match, fields: query.fields }),
    languages,
    flaggedOnly: query.flaggedOnly ?? false,
    parentId: query.parentId,
    standaloneOnly: query.standaloneOnly ?? false,
    id: query.id,
    listedOnly: query.listedOnly,
    // One more than a page says whether there is a next one.
    limit: INGREDIENT_PAGE_SIZE + 1,
    offset,
  });
  const may = (householdId: string | null) => mayEditOwnedRow(actor, householdId);
  const page = rows.slice(0, INGREDIENT_PAGE_SIZE);
  const [parentNames, icons] = await Promise.all([
    findLocaleNames(
      actor.householdId,
      page.flatMap((row) => (row.parent ? [row.parent.id] : []))
    ),
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
  const aliases = await listCatalogueAliasesOf(actor.householdId, ingredientId);

  return aliases.map((alias) =>
    spelling(alias, (householdId) => mayEditOwnedRow(actor, householdId))
  );
}

function spelling(
  alias: CatalogueAlias,
  may: (householdId: string | null) => boolean
): IngredientSpelling {
  return {
    id: alias.id,
    text: alias.text,
    locale: alias.locale ?? null,
    seeded: alias.seeded ?? false,
    canRemove: may(alias.householdId),
  };
}

function listItem(
  row: CatalogueIngredient,
  may: (householdId: string | null) => boolean,
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
    canEdit: may(row.householdId),
    aliases: shown,
    hiddenSpellings: all.length - shown.length,
  };
}

/**
 * What an edit did: the Ingredients it changed, for every screen showing them to refetch, and who
 * hears of it (`audienceOf`): their household, or everyone (null).
 */
export interface CatalogueEdit {
  changed: string[];
  audience: string | null;
}

/**
 * Run an edit in one transaction, so a refusal anywhere undoes it all; once committed, the
 * Ingredients it changed are announced.
 */
export async function inEdit<T extends CatalogueEdit>(
  run: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const edit = await withTransaction(run);

  if (edit.changed.length > 0) await ingredientChanges().changed(edit.changed, edit.audience);

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

/** Refuse unless the row is in the actor's catalogue and `actor` may edit it. */
export async function assertMayEdit<T extends CatalogueOwner>(
  actor: CatalogueActor,
  row: T | null
): Promise<T> {
  if (!row) throw new CatalogueEditError("not-found");
  if (!mayEditOwnedRow(actor, row.householdId)) {
    throw new CatalogueEditError("forbidden");
  }

  return row;
}

/** The one access check on a food by id: in the actor's catalogue and theirs to edit; its household. */
async function assertMayEditIngredient(
  tx: DbTransaction,
  actor: CatalogueActor,
  ingredientId: string
): Promise<string | null> {
  return (
    await assertMayEdit(
      actor,
      await findCatalogueIngredientOwner(tx, actor.householdId, ingredientId)
    )
  ).householdId;
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
 * Add a household spelling to any Ingredient of its catalogue, seeded too, stored clean
 * (`cleanSpelling`) and taken off the household's junk pile; one another of the household's foods
 * holds is refused, one this Ingredient is known by already is a no-op.
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
  const food = await findCatalogueIngredientOwner(tx, actor.householdId, ingredientId);

  if (!food) throw new CatalogueEditError("not-found");

  const fold = ingredientAliasFold(cleaned);
  // The spelling is the adder's household's, on a seeded food too.
  const audience = actor.householdId;
  const piled = await takeOffJunkPile(tx, actor.householdId, [fold]);

  if ((await findIngredientIdByFold(tx, actor.householdId, fold)) === ingredientId) {
    return { changed: [ingredientId], audience, piled };
  }
  // The household's spelling beats the seed's of the same fold, so only its own refuses one.
  const alias = await insertCatalogueAlias(tx, {
    householdId: actor.householdId,
    ingredientId,
    text: cleaned,
    fold,
    ownerId: actor.userId,
  });

  if (!alias) throw new CatalogueEditError("spelling-taken");

  return { changed: [ingredientId], audience, piled };
}

/** What adding a food by hand came to: the food the household now has, and whether it is new. */
interface AddedIngredient extends CatalogueEdit {
  ingredientId: string;
  created: boolean;
}

/** Adds a food by hand (`ingredients.add`) as a household food whose spellings no sweep or AI
 * deletes; a name already in the catalogue or seed answers that food, a held spelling refuses. */
export async function addIngredient(
  actor: CatalogueActor,
  name: string,
  spellings: readonly string[] = []
): Promise<AddedIngredient> {
  const { piled, ...added } = await inEdit(async (tx) => {
    const cleaned = cleanIngredientText(name);

    if (!cleaned) throw new CatalogueEditError("empty");
    const audience = actor.householdId;
    const existing = await lockIngredientNamed(tx, actor.householdId, cleaned);

    if (existing)
      return { ingredientId: existing, created: false, changed: [], audience, piled: 0 };
    const ingredientId = await refusedOn("name-taken", () =>
      insertCatalogueIngredient(tx, {
        householdId: actor.householdId,
        name: cleaned,
        ownerId: actor.userId,
        flagged: false,
        flagReason: null,
        addedByHand: true,
        nameChosen: true,
        nameSettled: true,
      })
    );
    let piled = 0;

    for (const text of [cleaned, ...spellings]) {
      if (cleanSpelling(cleanIngredientText(text))) {
        piled += (await addAliasIn(tx, actor, ingredientId, text)).piled;
      }
    }

    return { ingredientId, created: true, changed: [ingredientId], audience, piled };
  });

  if (piled > 0) forgetSpellingRules();

  return added;
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
  const householdId = await assertMayEditIngredient(tx, actor, ingredientId);

  // A name the household's catalogue (the seed's, for a seeded food) has for another food is taken.
  if (await lockIngredientNamed(tx, householdId, cleaned, ingredientId)) {
    throw new CatalogueEditError("name-taken");
  }
  const renamed = await refusedOn("name-taken", () =>
    renameCatalogueIngredient(tx, ingredientId, cleaned, householdId)
  );

  if (!renamed) throw new CatalogueEditError("not-found");
  // Naming the food is looking after it: what AI was unsure of is the person's now.
  await keepOpenAIChangesOf(tx, ingredientId);
  const spelling = cleanSpelling(cleaned);

  if (spelling) {
    await addSpellingUnlessKnown(tx, {
      householdId,
      ingredientId,
      text: spelling,
      fold: ingredientAliasFold(spelling),
      ownerId: actor.userId,
    });
  }

  return { changed: [ingredientId], audience: audienceOf(actor, householdId) };
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
  // The tree lock before the checks, so no join or leave moves the foods after them.
  await lockTree(tx);
  const householdId = await assertMayEditIngredient(tx, actor, ingredientId);
  const ids = parentId ? [ingredientId, parentId] : [ingredientId];

  if (parentId && !(await findCatalogueIngredientOwner(tx, actor.householdId, parentId))) {
    throw new CatalogueEditError("not-found");
  }
  if (!(await lockFoods(tx, ids))) throw new CatalogueEditError("not-found");
  if (parentId && (await closesCycle(tx, ingredientId, parentId))) {
    throw new CatalogueEditError("cycle");
  }
  // The parent it leaves and the one it joins each count one kind more or less.
  const [previous] = (await findIngredientAncestors([ingredientId], tx)).get(ingredientId) ?? [];

  // A seeded food is every household's, so it is filed only under a seeded one.
  if (!(await setCatalogueIngredientParent(tx, ingredientId, parentId))) {
    throw new CatalogueEditError("forbidden");
  }
  await keepOpenAIChangesOf(tx, ingredientId);

  return {
    changed: [
      ...new Set([ingredientId, ...(previous ? [previous] : []), ...(parentId ? [parentId] : [])]),
    ],
    audience: audienceOf(actor, householdId),
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
  const { naming, audience } = await withTransaction(async (tx) => {
    // The tree lock before the check: no merge into this food lands while it goes, nor a move.
    await lockTree(tx);
    const householdId = await assertMayEditIngredient(tx, actor, ingredientId);

    if (!(await lockFoods(tx, [ingredientId]))) throw new CatalogueEditError("not-found");
    const rows = await findRowsNamingFood(tx, ingredientId);

    await deleteCatalogueIngredient(tx, ingredientId);

    return { naming: rows, audience: audienceOf(actor, householdId) };
  });

  try {
    await resolveAgain(naming, "repoint");
  } finally {
    // The delete went through either way.
    await ingredientChanges().changed([ingredientId], audience);
  }

  return { changed: [ingredientId], audience };
}

/**
 * The nightly sweep, household by household: delete own Ingredients nothing has named for 90 days
 * that no person added by hand; seeded ones stay.
 */
export async function sweepUnusedIngredients(): Promise<{ deleted: number }> {
  const counts = await forEachCatalogue(async (householdId) => {
    const deleted = await withTransaction(async (tx) => {
      await lockTree(tx);

      return await sweepUnusedCatalogueIngredients(tx, householdId);
    });

    if (deleted.length > 0) await ingredientChanges().changed(deleted, householdId);

    return deleted.length;
  });

  return { deleted: counts.reduce((sum, count) => sum + count, 0) };
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
    const householdId = await assertMayEditIngredient(tx, actor, ingredientId);

    if (!(await keepIngredientDistinct(tx, ingredientId, householdId))) {
      throw new CatalogueEditError("not-found");
    }
    await keepOpenAIChangesOf(tx, ingredientId);

    return { changed: [ingredientId], audience: audienceOf(actor, householdId) };
  });
}

/**
 * Merge `sourceId` into `targetId` (`edit` on both): the source's spellings and their lines mean
 * the target, and the source goes. Never across households, nor a seeded food into a household's;
 * a household's food goes into a seeded one only by an admin of that household.
 */
export async function mergeIngredients(
  actor: CatalogueActor,
  sourceId: string,
  targetId: string
): Promise<CatalogueEdit> {
  if (sourceId === targetId) throw new CatalogueEditError("same-ingredient");

  return await inEdit(async (tx) => {
    // The tree lock before the checks, as `moveAlias` takes it.
    await lockTree(tx);
    const householdId = await assertMayEditIngredient(tx, actor, sourceId);

    await assertMayEditIngredient(tx, actor, targetId);
    if (!(await fitsInCatalogueOf(tx, sourceId, targetId))) {
      throw new CatalogueEditError("forbidden");
    }
    if (!(await mergeCatalogueIngredients(tx, sourceId, targetId))) {
      throw new CatalogueEditError("not-found");
    }

    return { changed: [sourceId, targetId], audience: audienceOf(actor, householdId) };
  });
}

/**
 * Move a spelling (`edit` on it) to another Ingredient of the catalogue, or to a new unflagged one
 * of the household named for it (`targetId` null), never a food's last. A seeded spelling moves only
 * to a seeded food. Answers the food it now names.
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

    const alias = await assertMayEdit(
      actor,
      await findCatalogueAliasOwner(tx, actor.householdId, aliasId)
    );
    const sourceId = alias.ingredientId;
    const audience = audienceOf(actor, alias.householdId);
    const target =
      targetId && (await findCatalogueIngredientOwner(tx, actor.householdId, targetId));

    if (targetId && !target) throw new CatalogueEditError("not-found");
    if (!(await lockFoods(tx, targetId ? [sourceId, targetId] : [sourceId]))) {
      throw new CatalogueEditError("not-found");
    }
    if (targetId === sourceId) return { ingredientId: sourceId, changed: [sourceId], audience };
    // Every household's rows may name a seeded spelling, so it stays on a seeded food.
    if (alias.householdId === null && (!target || target.householdId !== null)) {
      throw new CatalogueEditError("forbidden");
    }
    if ((await countAliasesOf(tx, sourceId, alias.householdId)) <= 1) {
      throw new CatalogueEditError("last-alias");
    }
    if (targetId) {
      await moveCatalogueAlias(tx, aliasId, targetId);

      return { ingredientId: targetId, changed: [sourceId, targetId], audience };
    }

    const to = await refusedOn("name-taken", () =>
      moveToFoodNamedFor(
        tx,
        { id: aliasId, text: alias.text },
        { householdId: actor.householdId, ownerId: actor.userId }
      )
    );

    // A person asked for a new food, so another one of that name refuses it.
    if (!to.minted) throw new CatalogueEditError("name-taken");

    return { ingredientId: to.id, changed: [sourceId, to.id], audience };
  });
}

/**
 * Move a spelling to the food of the household's catalogue named for it, minted in the household
 * with `values` where no food there has that name.
 */
export async function moveToFoodNamedFor(
  tx: DbTransaction,
  alias: { id: string; text: string },
  values: Omit<Parameters<typeof insertCatalogueIngredient>[1], "name">
): Promise<{ id: string; minted: boolean }> {
  const existing = await lockIngredientNamed(tx, values.householdId, alias.text);
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
  const alias = await assertMayEdit(
    actor,
    await findCatalogueAliasOwner(tx, actor.householdId, aliasId)
  );

  if (of !== undefined && alias.ingredientId !== of) throw new CatalogueEditError("not-found");

  // The Ingredient is locked, not only the alias: two members removing its
  // last two spellings at once must not both find a sibling left.
  if ((await lockIngredients(tx, [alias.ingredientId])) < 1) {
    throw new CatalogueEditError("not-found");
  }
  // Read again under the food's lock: a join or leave may have moved the spelling since.
  const locked = await findCatalogueAliasOwner(tx, actor.householdId, aliasId);

  if (locked?.householdId !== alias.householdId || locked.ingredientId !== alias.ingredientId) {
    throw new CatalogueEditError("not-found");
  }
  if ((await countAliasesOf(tx, alias.ingredientId, alias.householdId)) <= 1) {
    throw new CatalogueEditError("last-alias");
  }
  await deleteCatalogueAlias(tx, aliasId);
  // The mark is the spelling's household's, or the seed's for a seeded spelling.
  const piled = junk
    ? await addToJunkPile(tx, alias.householdId, [alias.fold], { reason: "person" })
    : 0;

  return {
    changed: [alias.ingredientId],
    audience: audienceOf(actor, alias.householdId),
    piled,
  };
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
    const food = await findCatalogueIngredientOwner(tx, actor.householdId, ingredientId);

    if (!food) throw new CatalogueEditError("not-found");

    const foodEdited =
      draft.name !== undefined || draft.parentId !== undefined || draft.icon !== undefined;
    const audiences = [foodEdited ? audienceOf(actor, food.householdId) : actor.householdId];

    if (draft.name !== undefined) await renameIngredientIn(tx, actor, ingredientId, draft.name);
    if (draft.parentId !== undefined) {
      const parented = await setParentIn(tx, actor, ingredientId, draft.parentId);

      for (const id of parented.changed) changed.add(id);
    }
    for (const aliasId of draft.remove) {
      const removed = await removeAliasIn(tx, actor, aliasId, {
        of: ingredientId,
        junk: draft.junk?.includes(aliasId),
      });

      piled += removed.piled;
      audiences.push(removed.audience);
    }
    for (const text of draft.add) {
      const added = await addAliasIn(tx, actor, ingredientId, text);

      piled += added.piled;
      audiences.push(added.audience);
    }
    if (draft.icon !== undefined) await setIconIn(tx, actor, ingredientId, draft.icon);

    // Everyone hears it once any part reaches past the household.
    return {
      changed: [...changed],
      audience: audiences.includes(null) ? null : actor.householdId,
      piled,
    };
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
  const householdId = await assertMayEditIngredient(tx, actor, ingredientId);

  if (icon !== null && !(await claimOwnIcon(icon))) throw new CatalogueEditError("not-found");
  if (!(await setIngredientIcon(tx, ingredientId, icon, { householdId }))) {
    throw new CatalogueEditError("not-found");
  }
}
