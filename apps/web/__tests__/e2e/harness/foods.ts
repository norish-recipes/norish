import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import { mintIngredientWithAliases } from "@norish/db/repositories/ingredient-aliases";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

/** A plain, ownerless food with its name as its one spelling; its alias and Ingredient. */
export async function mintFood(name: string): Promise<IngredientRef> {
  const fold = ingredientAliasFold(name);
  const aliases = await mintIngredientWithAliases({
    name,
    aliases: [{ text: name, fold }],
    ownerId: null,
    locale: null,
    flagged: false,
  });
  const alias = aliases.find((row) => row.fold === fold);

  if (!alias) throw new Error(`Could not mint ${name}`);

  return alias;
}
