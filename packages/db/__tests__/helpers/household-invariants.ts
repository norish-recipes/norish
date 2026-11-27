/** The household boundary's two invariants (ADR-0042, ADR-0043), checked after every move. */
import { and, eq, isNotNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { expect } from "vitest";

import {
  categories,
  cuisines,
  ingredientAliases,
  ingredients,
  recipeCategories,
  recipeCuisines,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
  recipeTags,
  tags,
} from "@norish/db/schema";

import { getTestDb } from "./db-test-helpers";

const LISTS = [
  { kind: "tag", table: tags, link: recipeTags, entity: recipeTags.tagId },
  { kind: "cuisine", table: cuisines, link: recipeCuisines, entity: recipeCuisines.cuisineId },
  {
    kind: "category",
    table: categories,
    link: recipeCategories,
    entity: recipeCategories.categoryId,
  },
] as const;

/** Recipe links to an entry of a household other than the recipe's own. */
async function foreignEntryLinks() {
  const found: Array<{ kind: string; recipeId: string; entryId: string }> = [];

  for (const { kind, table, link, entity } of LISTS) {
    const rows = await getTestDb()
      .select({ recipeId: link.recipeId, entryId: table.id })
      .from(link)
      .innerJoin(table, eq(table.id, entity))
      .innerJoin(recipes, eq(recipes.id, link.recipeId))
      .where(and(isNotNull(table.householdId), ne(table.householdId, recipes.householdId)));

    found.push(...rows.map((row) => ({ kind, ...row })));
  }

  return found;
}

/** Recipe lines naming a food or spelling of a household other than the recipe's own. */
async function foreignLineFoods() {
  const food = alias(ingredients, "line_food");

  return await getTestDb()
    .select({ lineId: recipeIngredientFoods.recipeIngredientId })
    .from(recipeIngredientFoods)
    .innerJoin(
      recipeIngredients,
      eq(recipeIngredients.id, recipeIngredientFoods.recipeIngredientId)
    )
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .innerJoin(ingredientAliases, eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId))
    .innerJoin(food, eq(food.id, ingredientAliases.ingredientId))
    .where(
      or(
        and(
          isNotNull(ingredientAliases.householdId),
          ne(ingredientAliases.householdId, recipes.householdId)
        ),
        and(isNotNull(food.householdId), ne(food.householdId, recipes.householdId))
      )
    );
}

/** Neither a recipe nor a line names anything of another household. */
export async function expectNothingForeign() {
  expect(await foreignEntryLinks()).toEqual([]);
  expect(await foreignLineFoods()).toEqual([]);
}
