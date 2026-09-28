import type {
  IngredientAliasRow,
  IngredientRef,
  IngredientRow,
} from "@norish/db/repositories/ingredient-aliases";
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
export interface ResolvedIngredient extends IngredientRef {
  text: string;
}

/** A text as the first two rungs read it: its fold, and its fold with the preparation stripped. */
interface Spelling {
  text: string;
  fold: string;
  bare: string;
  bareFold: string;
}

function spellingOf(text: string): Spelling {
  const bare = stripPreparation(text);

  return {
    text,
    fold: ingredientAliasFold(text),
    bare,
    bareFold: bare ? ingredientAliasFold(bare) : "",
  };
}

/** The aliases Norish already has for these spellings, by fold, in one query. */
async function knownAliases(
  spellings: readonly Spelling[]
): Promise<Map<string, IngredientAliasRow>> {
  const rows = await findIngredientAliasesByFolds(
    spellings.flatMap((spelling) => [spelling.fold, spelling.bareFold])
  );

  return new Map(rows.map((row) => [row.fold, row]));
}

/** Rungs 1 and 2: the alias with the text's fold, else the one with its stripped fold. */
function matchKnown(
  spelling: Spelling,
  known: ReadonlyMap<string, IngredientAliasRow>
): IngredientAliasRow | undefined {
  return known.get(spelling.fold) ?? (spelling.bareFold ? known.get(spelling.bareFold) : undefined);
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

  const spellings = cleaned.map(spellingOf);
  const known = await knownAliases(spellings);
  const resolved: ResolvedIngredient[] = [];

  for (const spelling of spellings) {
    const match = matchKnown(spelling, known);

    if (!match) {
      for (const row of await mint(spelling, actor)) known.set(row.fold, row);
    }

    const alias = match ?? known.get(spelling.fold)!;

    resolved.push({
      text: spelling.text,
      aliasId: alias.aliasId,
      ingredientId: alias.ingredientId,
    });
  }

  return resolved;
}

/**
 * Resolve one text as written, or answer null where it is markup alone and so
 * names no food. For the callers that take a single name from a person.
 */
export async function resolveIngredient(
  text: string,
  actor: ResolveActor
): Promise<ResolvedIngredient | null> {
  if (!cleanIngredientText(text)) return null;

  const [resolved] = await resolveIngredients([text], actor);

  return resolved ?? null;
}

/**
 * Rung 4. The Ingredient is named for the text without its preparation, and
 * that bare name becomes an alias beside the text, so "onions, diced" first
 * and "onions" or "onions, sliced" later are the one food.
 */
async function mint(
  { text, fold, bare, bareFold }: Spelling,
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
export async function findIngredientFor(text: string): Promise<IngredientRef | null> {
  const cleaned = cleanIngredientText(text);

  if (!cleaned) return null;

  const spelling = spellingOf(cleaned);
  const match = matchKnown(spelling, await knownAliases([spelling]));

  return match ? { aliasId: match.aliasId, ingredientId: match.ingredientId } : null;
}
