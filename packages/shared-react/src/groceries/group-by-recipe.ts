import type { GroceryDto } from "@norish/shared/contracts";

import type { GroceriesQueryResult } from "./types";

export interface RecipeGroceries {
  /** Null for the lines no recipe added. */
  recipeId: string | null;
  recipeName: string;
  groceries: GroceryDto[];
}

/** The list by recipe: the lines no recipe added first, under `manualName`, then each recipe's
 * lines under its name, in name order. */
export function groupGroceriesByRecipe(
  groceries: readonly GroceryDto[],
  recipeMap: GroceriesQueryResult["recipeMap"],
  manualName: string
): RecipeGroceries[] {
  const manual: GroceryDto[] = [];
  const byRecipe = new Map<string, { name: string; groceries: GroceryDto[] }>();

  for (const grocery of groceries) {
    const info = grocery.recipeIngredientId ? recipeMap[grocery.recipeIngredientId] : undefined;

    if (!info) {
      manual.push(grocery);
      continue;
    }
    const group = byRecipe.get(info.recipeId) ?? { name: info.recipeName, groceries: [] };

    group.groceries.push(grocery);
    byRecipe.set(info.recipeId, group);
  }

  const recipes = [...byRecipe]
    .map(([recipeId, group]) => ({
      recipeId,
      recipeName: group.name,
      groceries: group.groceries,
    }))
    .sort((a, b) => a.recipeName.localeCompare(b.recipeName));

  return [
    ...(manual.length > 0 ? [{ recipeId: null, recipeName: manualName, groceries: manual }] : []),
    ...recipes,
  ];
}
