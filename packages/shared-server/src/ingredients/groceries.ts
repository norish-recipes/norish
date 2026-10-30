import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import { findGroceryFoods } from "@norish/db/repositories/groceries";
import { findRecipeLineAliases } from "@norish/db/repositories/ingredient-aliases";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { ResolveActor } from "./resolver";
import { cleanIngredientText, resolveIngredients, typedParts } from "./resolver";

/** A grocery's name as written, the recipe line it was added from, and the grocery it edits, if any. */
export interface GroceryName {
  name: string | null;
  recipeIngredientId?: string | null;
  groceryId?: string | null;
}

/** The food an item keeps, if any: an edit's unchanged text, or a one-food line's own text. */
async function keptFoods(
  items: readonly GroceryName[]
): Promise<Array<{ food: IngredientRef | null } | undefined>> {
  const [lines, edited] = await Promise.all([
    findRecipeLineAliases(
      items.flatMap((item) => (item.recipeIngredientId ? [item.recipeIngredientId] : []))
    ),
    findGroceryFoods(items.flatMap((item) => (item.groceryId ? [item.groceryId] : []))),
  ]);

  return items.map((item) => {
    const fold = ingredientAliasFold(cleanIngredientText(item.name ?? ""));
    const grocery = item.groceryId ? edited.get(item.groceryId) : undefined;
    const line = item.recipeIngredientId ? lines.get(item.recipeIngredientId) : undefined;

    if (!fold) return undefined;
    if (grocery && ingredientAliasFold(cleanIngredientText(grocery.name ?? "")) === fold) {
      return grocery;
    }

    return line && line.foods.length <= 1 && ingredientAliasFold(line.name) === fold
      ? { food: line.foods[0] ?? null }
      : undefined;
  });
}

/**
 * The alias each grocery's name resolves to, null for none, read like a recipe line's text; a name
 * that keeps its food (`keptFoods`), or its having none, is not asked again.
 */
export async function resolveGroceryNames(
  items: readonly GroceryName[],
  actor: ResolveActor
): Promise<Array<IngredientRef | null>> {
  const texts = items.map((item) => cleanIngredientText(item.name ?? ""));
  const kept = await keptFoods(items);
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
 * peper" is "zout" and "peper", "boter of olie" is "boter". A kept name (`keptFoods`) stays whole.
 */
export async function groceryParts<T extends GroceryName & { id?: string | null }>(
  items: readonly T[]
): Promise<Array<[T, ...T[]]>> {
  const [kept, split] = await Promise.all([
    keptFoods(items),
    typedParts(items, { alternatives: "first" }),
  ]);

  return items.map((item, index) => (!kept[index] && split[index]) || [item]);
}

/** `groceryParts` for one grocery. */
export async function groceryPartsOf<T extends GroceryName & { id?: string | null }>(
  item: T
): Promise<[T, ...T[]]> {
  const [parts = [item]] = await groceryParts([item]);

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
