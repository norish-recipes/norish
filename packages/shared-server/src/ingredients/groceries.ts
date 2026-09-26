import { findRecipeLineAliases } from "@norish/db/repositories/ingredient-aliases";

import type { ResolveActor } from "./resolver";
import { cleanIngredientText, ingredientAliasFold, resolveIngredients } from "./resolver";

/** A grocery's name as written, and the recipe line it was added from, if any. */
export interface GroceryName {
  name: string | null;
  recipeIngredientId?: string | null;
}

/**
 * The alias each grocery's name resolves to, in order; null for a grocery
 * with no name. A grocery added from a recipe line under that line's own text
 * takes the line's alias, so the list and the recipe agree on the food; one
 * whose text was changed on its way to the list is resolved from what it now
 * says. Everything else — typed by hand, repeating, replayed after being
 * added offline — is resolved like any recipe line.
 */
export async function resolveGroceryNames(
  items: readonly GroceryName[],
  actor: ResolveActor
): Promise<Array<{ aliasId: string; ingredientId: string } | null>> {
  const lines = await findRecipeLineAliases(
    items.flatMap((item) => (item.recipeIngredientId ? [item.recipeIngredientId] : []))
  );
  const texts = items.map((item) => cleanIngredientText(item.name ?? ""));
  const lineAlias = items.map((item, index) => {
    const line = item.recipeIngredientId ? lines.get(item.recipeIngredientId) : undefined;

    return line &&
      texts[index] &&
      ingredientAliasFold(line.name) === ingredientAliasFold(texts[index])
      ? line
      : undefined;
  });
  const toResolve = texts.filter((text, index) => text && !lineAlias[index]);
  const resolved = new Map(
    (await resolveIngredients(toResolve, actor)).map((row) => [row.text, row])
  );

  return texts.map((text, index) => {
    if (!text) return null;

    const answer = lineAlias[index] ?? resolved.get(text);

    return answer ? { aliasId: answer.aliasId, ingredientId: answer.ingredientId } : null;
  });
}
