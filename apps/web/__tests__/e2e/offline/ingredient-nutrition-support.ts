import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";

import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import type { NutritionCodes } from "@norish/db/schema";
import {
  findIngredientAliasesByFolds,
  mintIngredientWithAliases,
} from "@norish/db/repositories/ingredient-aliases";
import { applyIngredientSeed } from "@norish/db/repositories/ingredient-seed";
import { createRecipeWithRefs } from "@norish/db/repositories/recipes";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { SessionCookies } from "../harness/auth";
import { userIdOf } from "../harness/accounts";
import { readRecipe } from "../harness/recipes";
import { deleteIngredients } from "../harness/reset";
import { callTrpc } from "../harness/trpc";
import { USER_A } from "./fixture";

/**
 * Seeding for the Ingredient Nutrition browser spec. The stack applies the
 * committed source table at boot, but fetches no taxonomy (its catalogue URL
 * is blank), so the spec seeds the few Ingredients it reads as the seed
 * would have: an Open Food Facts id and the codes the taxonomy gives them.
 * A legacy mint ("salt to taste", flagged, as the resolver made it before
 * rung 2 stripped phrases) stands for an instance's history.
 */

export interface NutritionScenario {
  recipeId: string;
  ingredientIds: Record<
    "onion" | "redOnion" | "rice" | "milk" | "oliveOil" | "salt" | "flour" | "cumin",
    string
  >;
  legacyId: string;
}

interface Food {
  key: keyof NutritionScenario["ingredientIds"];
  name: string;
  offId: string;
  codes: NutritionCodes | null;
  parent?: keyof NutritionScenario["ingredientIds"];
}

const FOODS: Food[] = [
  {
    key: "onion",
    name: "onion",
    offId: "en:onion",
    codes: { ciqual: ["20034"], usda: [], ciqualOther: [], pieceWeight: 150, density: null },
  },
  // No codes of its own: it borrows the onion's numbers and piece weight.
  { key: "redOnion", name: "red onion", offId: "en:red-onion", codes: null, parent: "onion" },
  {
    key: "rice",
    name: "rice",
    offId: "en:rice",
    codes: { ciqual: ["9100"], usda: [], ciqualOther: [], pieceWeight: null, density: null },
  },
  // The taxonomy's code is skimmed milk; Norish's fix list makes it whole.
  {
    key: "milk",
    name: "milk",
    offId: "en:milk",
    codes: { ciqual: ["19051"], usda: [], ciqualOther: [], pieceWeight: null, density: 1.03 },
  },
  {
    key: "oliveOil",
    name: "olive oil",
    offId: "en:olive-oil",
    codes: { ciqual: ["17270"], usda: [], ciqualOther: [], pieceWeight: null, density: 0.92 },
  },
  {
    key: "salt",
    name: "salt",
    offId: "en:salt",
    codes: { ciqual: ["11058"], usda: [], ciqualOther: [], pieceWeight: null, density: null },
  },
  // Numbers from CIQUAL, which weighs no cups, and no density from anywhere.
  {
    key: "flour",
    name: "flour",
    offId: "en:wheat-flour",
    codes: { ciqual: ["9410"], usda: [], ciqualOther: [], pieceWeight: null, density: null },
  },
  // No code at all: its numbers are Norish's fix (CIQUAL's cumin seed), its
  // spoon weight a density fix (USDA's teaspoon of cumin seed).
  { key: "cumin", name: "cumin", offId: "en:cumin", codes: null },
];

export const RECIPE_NAME = "Nutrition worked out";

/** The recipe's lines: [text, amount, unit, food]. */
const LINES: Array<
  [string, number | null, string | null, keyof NutritionScenario["ingredientIds"] | "legacy"]
> = [
  ["onion", 200, "gram", "onion"],
  ["rice", 300, "gram", "rice"],
  ["red onion", 3, null, "redOnion"],
  ["milk", 250, "milliliter", "milk"],
  ["flour", 1, "cup", "flour"],
  ["komijn", 1, "teaspoon", "cumin"],
  ["olive oil for frying", null, null, "oliveOil"],
  ["salt to taste", null, null, "legacy"],
];

/** Seed the Ingredients, the legacy mint and user A's recipe, and answer their ids. */
export async function seedNutritionScenario(): Promise<NutritionScenario> {
  const owner = await userIdOf(USER_A);
  const offIds = new Map(FOODS.map((food) => [food.key, food.offId]));
  const folds = new Map(FOODS.map((food) => [food.key, ingredientAliasFold(food.name)]));

  await applyIngredientSeed(
    FOODS.map((food) => ({
      offId: food.offId,
      name: food.name,
      nameFold: folds.get(food.key)!,
      parentOffId: food.parent ? offIds.get(food.parent)! : null,
      aliases: [{ text: food.name, fold: folds.get(food.key)!, locale: "en" }],
      nutrition: food.codes,
    }))
  );

  const [legacy] = await mintIngredientWithAliases({
    name: "salt to taste",
    aliases: [{ text: "salt to taste", fold: ingredientAliasFold("salt to taste") }],
    ownerId: owner,
    locale: null,
    flagged: true,
    flagReason: "upgrade",
  });
  const aliases = await findIngredientAliasesByFolds([...folds.values()]);
  const refs = new Map<string, IngredientRef>(
    FOODS.map((food) => [food.key, aliases.find((row) => row.fold === folds.get(food.key))!])
  );

  refs.set("legacy", legacy!);

  const recipeId = randomUUID();

  await createRecipeWithRefs(recipeId, owner, {
    name: RECIPE_NAME,
    servings: 2,
    systemUsed: "metric",
    recipeIngredients: LINES.map(([ingredientName, amount, unit], order) => ({
      ingredientName,
      ingredientId: null,
      amount,
      unit,
      order,
    })),
    ingredientResolutions: new Map(
      LINES.map(([text, , , food]) => [text, { foods: [refs.get(food)!], joined: null }])
    ),
  });

  return {
    recipeId,
    ingredientIds: Object.fromEntries(
      FOODS.map((food) => [food.key, refs.get(food.key)!.ingredientId])
    ) as NutritionScenario["ingredientIds"],
    legacyId: legacy!.ingredientId,
  };
}

/** Have the next boot look at old flagged mints again, as an upgrade to new rules would. */
export async function forgetRungVersion(): Promise<void> {
  const state = await getConfig<Record<string, unknown>>("ingredient_seed_state");

  await setConfig("ingredient_seed_state", { ...state, rungVersion: 0 }, null, false);
}

/** Which Ingredient a recipe line points at now, as the reader's recipe has it. */
export async function lineIngredient(
  baseURL: string,
  cookies: SessionCookies,
  recipeId: string,
  text: string
): Promise<string | null> {
  const recipe = await readRecipe(baseURL, cookies, recipeId);

  return (
    recipe?.recipeIngredients.find((line) => line.ingredientName === text)?.ingredientId ?? null
  );
}

/** Take the scenario away again, so the offline suite after it finds what it seeded. */
export async function removeNutritionScenario(
  baseURL: string,
  cookiesA: SessionCookies,
  scenario: NutritionScenario | null
): Promise<void> {
  if (!scenario) return;

  const recipe = await readRecipe(baseURL, cookiesA, scenario.recipeId);

  // The delete lands after the mutation answers.
  if (recipe) {
    await callTrpc(baseURL, cookiesA, "recipes.delete", { id: recipe.id, version: recipe.version });
    await expect.poll(() => readRecipe(baseURL, cookiesA, recipe.id)).toBeNull();
  }
  await deleteIngredients([...Object.values(scenario.ingredientIds), scenario.legacyId]);
}
