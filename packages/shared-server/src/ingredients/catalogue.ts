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
 * flag: looking after it counts as reviewing it.
 */
import type { PermissionLevel } from "@norish/config/zod/server-config";
import type {
  CatalogueAlias,
  CatalogueIngredient,
} from "@norish/db/repositories/ingredient-catalogue";
import type { CatalogueRefusal, FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { findLocaleNames } from "@norish/db/repositories/ingredient-aliases";
import {
  clearIngredientFlag,
  deleteCatalogueAlias,
  deleteCatalogueIngredient,
  findCatalogueAliasOwner,
  findCatalogueIngredientOwner,
  findIngredientIdByFold,
  insertCatalogueAlias,
  listCatalogueAliasesOf,
  listCatalogueIngredients,
  renameCatalogueIngredient,
} from "@norish/db/repositories/ingredient-catalogue";
import {
  mergeCatalogueIngredients,
  moveCatalogueAlias,
  setCatalogueIngredientParent,
} from "@norish/db/repositories/ingredient-relocation";
import { getIngredientPermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { isFlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import { foldName } from "@norish/shared/lib/fold-name";
import { catalogueLanguagesFor, chooseLocaleNames } from "@norish/shared/lib/ingredient-names";

import { cleanIngredientText, ingredientAliasFold } from "./resolver";

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
 * A page of the catalogue: every Ingredient, or the flagged ones, or those
 * whose name or a spelling contains the search, by name. Every row says what
 * the viewer may do, so an action they may not take is never offered. The
 * viewer's `locale` picks which spellings ride along.
 */
export async function listIngredients(
  actor: CatalogueActor,
  query: { search?: string; flaggedOnly?: boolean; offset?: number; locale?: string }
): Promise<{ items: IngredientListItem[]; nextOffset: number | null }> {
  const search = query.search?.trim() ?? "";
  const offset = query.offset ?? 0;
  const languages = catalogueLanguagesFor(query.locale ?? "en");
  const [policy, rows] = await Promise.all([
    getIngredientPermissionPolicy(),
    listCatalogueIngredients({
      search: search ? { lower: search.toLowerCase(), fold: foldName(search) } : null,
      flaggedOnly: query.flaggedOnly ?? false,
      // One more than a page says whether there is a next one.
      limit: INGREDIENT_PAGE_SIZE + 1,
      offset,
    }),
  ]);
  const may = (ownerId: string | null) => mayEditIngredientRow(policy.edit, actor, ownerId);
  const page = rows.slice(0, INGREDIENT_PAGE_SIZE);
  const parentNames = await findLocaleNames(
    page.flatMap((row) => (row.parent ? [row.parent.id] : []))
  );

  return {
    items: page.map((row) => listItem(row, may, parentNames, languages)),
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
  languages: readonly string[]
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
    canEdit: may(row.ownerId),
    aliases: shown,
    hiddenSpellings: all.length - shown.length,
  };
}

/** Refuse unless `actor` may edit the Ingredient; answers nothing otherwise. */
async function assertMayEditIngredient(actor: CatalogueActor, ingredientId: string) {
  const [owner, policy] = await Promise.all([
    findCatalogueIngredientOwner(ingredientId),
    getIngredientPermissionPolicy(),
  ]);

  if (!owner) throw new CatalogueEditError("not-found");
  if (!mayEditIngredientRow(policy.edit, actor, owner.ownerId)) {
    throw new CatalogueEditError("forbidden");
  }
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
): Promise<CatalogueAlias | null> {
  const cleaned = cleanIngredientText(text);

  if (!cleaned) throw new CatalogueEditError("empty");
  if (!(await findCatalogueIngredientOwner(ingredientId))) {
    throw new CatalogueEditError("not-found");
  }

  const fold = ingredientAliasFold(cleaned);
  const alias = await insertCatalogueAlias({
    ingredientId,
    text: cleaned,
    fold,
    ownerId: actor.userId,
  });

  if (alias) return alias;
  if ((await findIngredientIdByFold(fold)) === ingredientId) return null;

  throw new CatalogueEditError("spelling-taken");
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
): Promise<void> {
  const cleaned = cleanIngredientText(name);

  if (!cleaned) throw new CatalogueEditError("empty");
  await assertMayEditIngredient(actor, ingredientId);
  const outcome = await renameCatalogueIngredient(ingredientId, cleaned);

  if (outcome === "taken") throw new CatalogueEditError("name-taken");
  if (outcome === "missing") throw new CatalogueEditError("not-found");
  await insertCatalogueAlias({
    ingredientId,
    text: cleaned,
    fold: ingredientAliasFold(cleaned),
    ownerId: actor.userId,
  });
}

/**
 * Set or clear an Ingredient's Parent Ingredient, which clears its flag.
 * Follows `edit` on the Ingredient; the parent is only pointed at, so its own
 * policy is not asked. A parent that would close a cycle is refused.
 */
export async function setParent(
  actor: CatalogueActor,
  ingredientId: string,
  parentId: string | null
): Promise<void> {
  await assertMayEditIngredient(actor, ingredientId);

  const outcome = await setCatalogueIngredientParent(ingredientId, parentId);

  if (outcome === "cycle") throw new CatalogueEditError("cycle");
  if (outcome === "missing") throw new CatalogueEditError("not-found");
}

/**
 * Delete an Ingredient nothing uses, its spellings with it. Follows `edit` on
 * the Ingredient. One a recipe line, grocery or Pantry Ingredient still
 * points at is refused: merging is how those are given another food.
 */
export async function deleteIngredient(actor: CatalogueActor, ingredientId: string): Promise<void> {
  await assertMayEditIngredient(actor, ingredientId);

  const outcome = await deleteCatalogueIngredient(ingredientId);

  if (outcome === "in-use") throw new CatalogueEditError("ingredient-in-use");
  if (outcome === "missing") throw new CatalogueEditError("not-found");
}

/** Mark a Flagged Ingredient distinct: Norish's doubt was unfounded. Follows `edit`. */
export async function markDistinct(actor: CatalogueActor, ingredientId: string): Promise<void> {
  await assertMayEditIngredient(actor, ingredientId);
  if (!(await clearIngredientFlag(ingredientId))) throw new CatalogueEditError("not-found");
}

/**
 * Merge `sourceId` into `targetId`: every spelling of the source, and every
 * line behind them, now means the target, and the source is gone — which is
 * also what clears its flag. Needs `edit` on both.
 */
export async function mergeIngredients(
  actor: CatalogueActor,
  sourceId: string,
  targetId: string
): Promise<void> {
  if (sourceId === targetId) throw new CatalogueEditError("same-ingredient");
  await assertMayEditIngredient(actor, sourceId);
  await assertMayEditIngredient(actor, targetId);
  if ((await mergeCatalogueIngredients(sourceId, targetId)) === "missing") {
    throw new CatalogueEditError("not-found");
  }
}

/**
 * Move a spelling to another Ingredient, or to a new one named for it
 * (`targetId` null) — the unmerge. Follows `edit` on the alias; the
 * Ingredient it leaves keeps its flag, and a new one is a person's choice, so
 * it is not flagged. Answers the Ingredient the spelling now names.
 */
export async function moveAlias(
  actor: CatalogueActor,
  aliasId: string,
  targetId: string | null
): Promise<{ ingredientId: string; fromIngredientId: string }> {
  const [alias, policy] = await Promise.all([
    findCatalogueAliasOwner(aliasId),
    getIngredientPermissionPolicy(),
  ]);

  if (!alias) throw new CatalogueEditError("not-found");
  if (!mayEditIngredientRow(policy.edit, actor, alias.ownerId)) {
    throw new CatalogueEditError("forbidden");
  }

  const moved = await moveCatalogueAlias(
    aliasId,
    targetId ? { ingredientId: targetId } : { mint: { name: alias.text, ownerId: actor.userId } }
  );

  if (moved.outcome === "moved") {
    return { ingredientId: moved.ingredientId, fromIngredientId: alias.ingredientId };
  }
  if (moved.outcome === "last") throw new CatalogueEditError("last-alias");
  if (moved.outcome === "name-taken") throw new CatalogueEditError("name-taken");
  throw new CatalogueEditError("not-found");
}

/**
 * Remove a spelling. Follows `edit` on the alias. An Ingredient keeps at
 * least one, and a spelling something points at stays until it is moved.
 * Answers the Ingredient the spelling was removed from.
 */
export async function removeAlias(
  actor: CatalogueActor,
  aliasId: string
): Promise<{ ingredientId: string }> {
  const [alias, policy] = await Promise.all([
    findCatalogueAliasOwner(aliasId),
    getIngredientPermissionPolicy(),
  ]);

  if (!alias) throw new CatalogueEditError("not-found");
  if (!mayEditIngredientRow(policy.edit, actor, alias.ownerId)) {
    throw new CatalogueEditError("forbidden");
  }

  const outcome = await deleteCatalogueAlias(aliasId);

  if (outcome === "last") throw new CatalogueEditError("last-alias");
  if (outcome === "in-use") throw new CatalogueEditError("alias-in-use");
  if (outcome === "missing") throw new CatalogueEditError("not-found");

  return { ingredientId: alias.ingredientId };
}
