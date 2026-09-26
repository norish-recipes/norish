import type { IngredientAliasRow, IngredientRow } from "@norish/db/repositories/ingredient-aliases";
import {
  findIngredientAliasesByFolds,
  findIngredientByAliasId,
  mintIngredientWithAliases,
} from "@norish/db/repositories/ingredient-aliases";
import { stripHtmlTags } from "@norish/shared/lib/helpers";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

/**
 * The ingredient resolver: the one module that mints Ingredients and
 * Ingredient Aliases (ADR-0037). Every path that stores a name for a food — a
 * recipe line, a Pantry Ingredient, a Grocery, a recurring grocery — hands its
 * text as written here and stores the alias that comes back; the text itself
 * is kept by the caller and shown as written.
 *
 * The resolution order for one text:
 *   1. an alias whose fold is the text's fold;
 *   2. an alias whose fold is the text's with preparation stripped — the part
 *      after the first comma and anything in brackets ("onions, diced" and
 *      "onions (red)" are "onions");
 *   3. (not yet: a Decision, or the language model);
 *   4. a new Ingredient with the text as its first alias.
 *
 * A mint that no AI step vouched for is flagged, so a person can merge it or
 * mark it distinct.
 */

/** Who the resolution is for: the owner of anything it mints. */
export interface ResolveActor {
  userId: string | null;
  /** The language the text is in, where the caller knows it. */
  locale?: string | null;
}

/** One text as written, and the alias and Ingredient it resolved to. */
export interface ResolvedIngredient {
  text: string;
  aliasId: string;
  ingredientId: string;
}

/**
 * The fold an alias is keyed by: the one grocery folding. A text that folds
 * to nothing (punctuation only) is keyed by its lowercase self, so it is still
 * one spelling rather than every such text at once.
 */
export function ingredientAliasFold(text: string): string {
  return normalizeGroceryName(text) || text.trim().toLowerCase();
}

/** The text with its preparation stripped: brackets removed, then cut at the first comma. */
export function stripPreparation(text: string): string {
  return text
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .split(",")[0]!
    .replace(/\s+/g, " ")
    .trim();
}

/** The as-written text a caller hands in, cleaned the way every stored name is. */
export function cleanIngredientText(text: string): string {
  return stripHtmlTags(text).replace(/\s+/g, " ").trim();
}

/**
 * Resolve texts as written to aliases, one per text and in the same order.
 * Texts that resolve alike share their answer, so one recipe that says
 * "onions" twice mints one Ingredient.
 */
export async function resolveIngredients(
  texts: readonly string[],
  actor: ResolveActor
): Promise<ResolvedIngredient[]> {
  const cleaned = texts.map(cleanIngredientText);

  if (cleaned.some((text) => text.length === 0)) {
    throw new Error("Ingredient text cannot be empty");
  }

  const stripped = cleaned.map(stripPreparation);
  const known = new Map<string, IngredientAliasRow>();

  for (const row of await findIngredientAliasesByFolds([
    ...cleaned.map(ingredientAliasFold),
    ...stripped.filter(Boolean).map(ingredientAliasFold),
  ])) {
    known.set(row.fold, row);
  }

  const resolved: ResolvedIngredient[] = [];

  for (const [index, text] of cleaned.entries()) {
    const fold = ingredientAliasFold(text);
    const bare = stripped[index]!;
    const bareFold = bare ? ingredientAliasFold(bare) : "";
    const match = known.get(fold) ?? (bareFold ? known.get(bareFold) : undefined);

    if (match) {
      resolved.push({ text, aliasId: match.aliasId, ingredientId: match.ingredientId });
      continue;
    }

    const minted = await mint(text, fold, bare, bareFold, actor);

    for (const row of minted) known.set(row.fold, row);

    const alias = known.get(fold)!;

    resolved.push({ text, aliasId: alias.aliasId, ingredientId: alias.ingredientId });
  }

  return resolved;
}

/**
 * Rung 4. The Ingredient is named for the text without its preparation, and
 * that bare name becomes an alias beside the text, so "onions, diced" first
 * and "onions" or "onions, sliced" later are the one food.
 */
async function mint(
  text: string,
  fold: string,
  bare: string,
  bareFold: string,
  actor: ResolveActor
): Promise<IngredientAliasRow[]> {
  const aliases = [{ text, fold }];

  if (bareFold && bareFold !== fold) aliases.push({ text: bare, fold: bareFold });

  return await mintIngredientWithAliases({
    name: bareFold ? bare : text,
    aliases,
    ownerId: actor.userId,
    locale: actor.locale ?? null,
    flagged: true,
  });
}

/** The Ingredient an alias points at. */
export async function ingredientFor(aliasId: string): Promise<IngredientRow | null> {
  return await findIngredientByAliasId(aliasId);
}

/**
 * The Ingredient a text already resolves to — an exact or a stripped alias
 * match — or null where Norish does not know it. For readers, which must not
 * mint: asking what a Store knows about a name Norish has never seen is
 * answered with nothing.
 */
export async function findIngredientFor(
  text: string
): Promise<{ aliasId: string; ingredientId: string } | null> {
  const cleaned = cleanIngredientText(text);

  if (!cleaned) return null;

  const fold = ingredientAliasFold(cleaned);
  const bare = stripPreparation(cleaned);
  const bareFold = bare ? ingredientAliasFold(bare) : "";
  const rows = await findIngredientAliasesByFolds([fold, bareFold]);
  const match = rows.find((row) => row.fold === fold) ?? rows.find((row) => row.fold === bareFold);

  return match ? { aliasId: match.aliasId, ingredientId: match.ingredientId } : null;
}
