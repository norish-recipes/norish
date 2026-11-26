/**
 * A recipe's worked-out nutrition for one household (ADR-0039), on the
 * server: its lines' Ingredient Nutrition as that household reads it,
 * through the shared arithmetic. The recipe page works the same total out
 * in the browser from the same module's answers; this is the language
 * model's estimate asking which lines are counted already, and the REST
 * API's answer, which adds the model's stored share of the lines left out as
 * the page does. A recipe that supplies Nutrition Information of its own has
 * none worked out.
 */
import type { NutritionCredit } from "@norish/shared/contracts/ingredient-nutrition";
import type { ExtraNutrient, ExtraNutrients } from "@norish/shared/contracts/nutrients";
import type {
  LeftOutReason,
  NutritionGapEstimate,
  RecipeForNutrition,
  WorkedOutNutrition,
} from "@norish/shared/lib/recipe-nutrition";
import { getIngredientWords, getUnits } from "@norish/shared-server/config/server-config-loader";
import { linesAsRead } from "@norish/shared/lib/line-foods";
import {
  nutritionLinesOf,
  seasoningPhrases,
  suppliesNutrition,
  withStatedExtras,
  workOutNutrition,
} from "@norish/shared/lib/recipe-nutrition";
import { spellingRules } from "@norish/shared/lib/spelling-keys";

import type { NutritionReader } from "./ingredient-nutrition";
import { lineReadingsOf } from "../line-readings";
import { resolveIngredientNutrition } from "./ingredient-nutrition";

/** The recipe's worked-out nutrition for the reader's household, or null where it supplies its own. */
export async function workOutRecipeNutrition(
  recipe: RecipeForNutrition,
  reader: NutritionReader,
  estimate: NutritionGapEstimate | null = null
): Promise<WorkedOutNutrition | null> {
  if (suppliesNutrition(recipe)) return null;

  const lines = nutritionLinesOf(recipe);
  const nutrition = await resolveIngredientNutrition(
    lines.flatMap((line) => (line.ingredientId ? [line.ingredientId] : [])),
    reader
  );

  const units = await getUnits();

  return workOutNutrition({
    lines,
    servings: recipe.servings,
    nutrition,
    seasoning: seasoningPhrases(units),
    rules: spellingRules(units, await getIngredientWords()),
    estimate,
  });
}

/** Calories and macros per serving, each null where the recipe does not say, and the other nutrients known. */
export interface ReadNutritionPerServing {
  calories: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
  extras: ExtraNutrients;
}

/** A recipe's nutrition per serving for an API client: what it supplies, else its lines' total
 * for the reader's household plus the model's stored share of lines left out, as the page shows. */
export interface RecipeNutritionAnswer {
  /** `supplied` by the recipe, `worked-out` from its lines, or `none` where neither gives a number. */
  source: "supplied" | "worked-out" | "none";
  perServing: ReadNutritionPerServing | null;
  /** Whether a worked-out total borrowed enough from parent foods, or took a line from the language model. */
  estimated: boolean;
  /** The lines a worked-out total left out, each with why and whether the model's share stands in for it. */
  leftOut: { name: string; reason: LeftOutReason; estimatedByAI: boolean }[];
  /** The datasets a worked-out total took a fact from. */
  credits: NutritionCredit[];
  /** Per extra nutrient, the share of counted grams whose food knew it (1 where stated); below 1
   * the value is low. */
  extrasCoverage: Partial<Record<ExtraNutrient, number>>;
}

function storedNumber(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/** The recipe's lines as the reader's household uses them: those outside its catalogue read again. */
async function readByReader(
  recipe: RecipeForNutrition,
  { householdId }: NutritionReader
): Promise<RecipeForNutrition> {
  if (!householdId || suppliesNutrition(recipe)) return recipe;
  const lineIds = recipe.recipeIngredients.flatMap((line) => (line.id ? [line.id] : []));
  const readings = await lineReadingsOf(householdId, { of: "lines", ids: lineIds });

  return { ...recipe, recipeIngredients: linesAsRead(recipe.recipeIngredients, readings) };
}

/** The recipe's nutrition per serving for the reader's household. */
export async function readRecipeNutrition(
  stored: RecipeForNutrition,
  reader: NutritionReader
): Promise<RecipeNutritionAnswer> {
  const recipe = await readByReader(stored, reader);
  const worked = await workOutRecipeNutrition(recipe, reader, recipe.nutritionEstimate ?? null);
  const { nutritionExtras: extras, extrasCoverage } = withStatedExtras(
    recipe.nutritionExtras,
    worked
  );
  const leftOut = (worked?.leftOut ?? []).map(({ name, reason, estimatedByAI }) => ({
    name,
    reason,
    estimatedByAI,
  }));

  if (suppliesNutrition(recipe)) {
    return {
      source: "supplied",
      perServing: {
        calories: storedNumber(recipe.calories),
        fat: storedNumber(recipe.fat),
        carbs: storedNumber(recipe.carbs),
        protein: storedNumber(recipe.protein),
        extras,
      },
      estimated: false,
      leftOut: [],
      credits: [],
      extrasCoverage,
    };
  }

  if (!worked?.perServing) {
    return {
      source: "none",
      perServing: null,
      estimated: false,
      leftOut,
      credits: [],
      extrasCoverage: {},
    };
  }

  return {
    source: "worked-out",
    perServing: { ...worked.perServing, extras },
    estimated: worked.estimated,
    leftOut,
    credits: worked.credits,
    extrasCoverage,
  };
}
