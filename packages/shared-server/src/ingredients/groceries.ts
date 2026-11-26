import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import { findGroceryFoods } from "@norish/db/repositories/groceries";
import { findRecipeLineAliases } from "@norish/db/repositories/ingredient-aliases";
import { foodsToBuy } from "@norish/shared/lib/line-foods";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { ReadLine } from "./line-readings";
import type { ResolveActor } from "./resolver";
import { readLines } from "./line-readings";
import { cleanIngredientText, resolveIngredients, typedParts } from "./resolver";

/** A grocery's name as written, the recipe line it was added from, and the grocery it edits, if any. */
export type GroceryName = {
  name: string | null;
  recipeIngredientId?: string | null;
} & ({ groceryId?: null } | { groceryId: string; householdId: string });

/** The groceries edits name, read in their own households. */
async function editedFoods(items: readonly GroceryName[]) {
  const edited = new Map<string, { name: string | null; food: IngredientRef | null }>();
  const edits = items.flatMap((item) => (item.groceryId ? [item] : []));

  for (const householdId of new Set(edits.map((edit) => edit.householdId))) {
    const ids = edits.flatMap((edit) => (edit.householdId === householdId ? [edit.groceryId] : []));

    for (const [id, food] of await findGroceryFoods(ids, householdId)) edited.set(id, food);
  }

  return edited;
}

/**
 * What an item means instead of its name as typed: a `food` it keeps whole (an edit's unchanged
 * text, a one-food line's own text), or, for a line read through the household's catalogue
 * (`readLines`), the `parts` it reads as, or the `meaning` text to resolve where it read none.
 */
type ItemMeaning =
  | { food: IngredientRef | null }
  | { parts: Array<{ name: string; food: IngredientRef }> }
  | { meaning: string }
  | undefined;

/** A read line's item: the line as written, or one food it reads as (each named as the sheet shows). */
function readMeaning(line: ReadLine, fold: string): ItemMeaning {
  const own = line.foods.find((food) => ingredientAliasFold(food.name) === fold);

  if (own) return { food: own };
  if (ingredientAliasFold(cleanIngredientText(line.name)) !== fold) return undefined;
  if (line.foods.length === 0) return { meaning: line.meaning };

  // As the sheet buys a line: each food of an "and" line, an "or" line's first.
  const { joined, foods } = line;
  const parts = foodsToBuy([{ ingredientId: foods[0]!.ingredientId, joined, foods }]).flatMap(
    (part) => foods.filter((food) => food.ingredientId === part.ingredientId)
  );

  return parts.length === 1
    ? { food: parts[0]! }
    : { parts: parts.map((food) => ({ name: food.name, food })) };
}

async function meaningsOf(
  items: readonly GroceryName[],
  householdId: string
): Promise<ItemMeaning[]> {
  const lineIds = items.flatMap((item) =>
    item.recipeIngredientId ? [item.recipeIngredientId] : []
  );
  const [lines, read, edited] = await Promise.all([
    findRecipeLineAliases(lineIds, householdId),
    readLines(householdId, { of: "lines", ids: lineIds }),
    editedFoods(items),
  ]);

  return items.map((item) => {
    const fold = ingredientAliasFold(cleanIngredientText(item.name ?? ""));
    const grocery = item.groceryId ? edited.get(item.groceryId) : undefined;
    const readLine = item.recipeIngredientId ? read.get(item.recipeIngredientId) : undefined;
    const line = item.recipeIngredientId ? lines.get(item.recipeIngredientId) : undefined;

    if (!fold) return undefined;
    if (grocery && ingredientAliasFold(cleanIngredientText(grocery.name ?? "")) === fold) {
      return grocery;
    }
    if (readLine) return readMeaning(readLine, fold);

    return line && line.foods.length <= 1 && ingredientAliasFold(line.name) === fold
      ? { food: line.foods[0] ?? null }
      : undefined;
  });
}

/**
 * The alias each grocery's name resolves to, null for none, read like a recipe line's text; a name
 * that keeps its food (`meaningsOf`), or its having none, is not asked again.
 */
export async function resolveGroceryNames(
  items: readonly GroceryName[],
  actor: ResolveActor
): Promise<Array<IngredientRef | null>> {
  const meanings = await meaningsOf(items, actor.householdId);
  const texts = items.map((item, index) => {
    const meant = meanings[index];

    return meant && "meaning" in meant ? meant.meaning : cleanIngredientText(item.name ?? "");
  });
  const kept = meanings.map((meant) =>
    meant && "food" in meant ? meant : meant && "parts" in meant ? meant.parts[0] : undefined
  );
  const toResolve = texts.filter((text, index) => text && !kept[index]);
  const answers = await resolveIngredients(toResolve, actor);
  const resolved = new Map(toResolve.map((text, index) => [text, answers[index]]));

  return texts.map((text, index) => {
    if (!text) return null;

    // A typed text that names no food (")") is kept on the list with none,
    // as is a kept grocery's or recipe line's whose food was deleted.
    const answer = kept[index] ? kept[index].food : resolved.get(text);

    return answer ? { aliasId: answer.aliasId, ingredientId: answer.ingredientId } : null;
  });
}

/**
 * Each grocery once per food its name names, as a Grocery names one food (`typedParts`): "zout en
 * peper" is "zout" and "peper", "boter of olie" is "boter". A kept name stays whole, and a line read
 * through the household's catalogue splits as it reads (`meaningsOf`).
 */
export async function groceryParts<T extends GroceryName & { id?: string | null }>(
  householdId: string,
  items: readonly T[]
): Promise<Array<[T, ...T[]]>> {
  const [meanings, split] = await Promise.all([
    meaningsOf(items, householdId),
    typedParts(householdId, items, { alternatives: "first" }),
  ]);

  return items.map((item, index): [T, ...T[]] => {
    const meant = meanings[index];

    if (!meant) return split[index] ?? [item];
    if (!("parts" in meant)) return [item];
    const [first, ...rest] = meant.parts.map((part) => part.name);

    return [{ ...item, name: first }, ...rest.map((name) => ({ ...item, id: undefined, name }))];
  });
}

/** `groceryParts` for one grocery. */
export async function groceryPartsOf<T extends GroceryName & { id?: string | null }>(
  householdId: string,
  item: T
): Promise<[T, ...T[]]> {
  const [parts = [item]] = await groceryParts(householdId, [item]);

  return parts;
}

/**
 * The columns a grocery row keeps for its name's food (ADR-0037): the alias and its Ingredient,
 * both null for a row with no name.
 */
export interface GroceryIngredientColumns {
  ingredientAliasId: string | null;
  ingredientId: string | null;
}

export function ingredientColumns(ref: IngredientRef | null | undefined): GroceryIngredientColumns {
  return { ingredientAliasId: ref?.aliasId ?? null, ingredientId: ref?.ingredientId ?? null };
}
