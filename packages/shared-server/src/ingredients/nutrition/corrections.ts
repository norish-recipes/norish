/**
 * A household's corrections to Ingredient Nutrition (ADR-0039): the last word
 * for that household about one Ingredient's numbers, piece weight or density.
 * Any member may correct any Ingredient, seeded or not: the ingredient
 * permission policy does not apply, because a correction is the household's
 * data rather than an edit to the Ingredient. The most recent member's
 * correction is the household's; removing it removes every member's, so the
 * datasets' numbers are back for all of them. Each change is announced to
 * the household alone.
 */
import type { NutritionCorrectionValues } from "@norish/db/repositories/ingredient-nutrition";
import type { NutritionFoodRef } from "@norish/shared/contracts/ingredient-nutrition";
import {
  findNutritionFoods,
  removeHouseholdCorrections,
  saveNutritionCorrection,
  searchNutritionFoods,
} from "@norish/db/repositories/ingredient-nutrition";
import { foldName } from "@norish/shared/lib/fold-name";

import { ingredients as ingredientsRealtime } from "../../realtime/ingredients";

/** Who is correcting: a member, their household, and the household's realtime key. */
export interface CorrectingMember {
  userId: string;
  householdUserIds: readonly string[];
  householdKey: string;
}

/** One fact of a correction: a dataset food, a number, or left to the sources. */
export type CorrectedFact<N> = { food: string } | N | null;

export interface NutritionCorrectionInput {
  numbers: CorrectedFact<{ kcal: number; fat: number; carbs: number; protein: number }>;
  pieceWeight: CorrectedFact<{ grams: number }>;
  density: CorrectedFact<{ gramsPerMl: number }>;
}

export type CorrectionRefusal = "not-found" | "unknown-food" | "empty";

export class NutritionCorrectionError extends Error {
  constructor(readonly refusal: CorrectionRefusal) {
    super(`Nutrition correction refused: ${refusal}`);
    this.name = "NutritionCorrectionError";
  }
}

function foodOf<N>(fact: CorrectedFact<N>): string | null {
  return fact && typeof fact === "object" && "food" in fact ? fact.food : null;
}

async function announce(member: CorrectingMember, ingredientId: string): Promise<void> {
  await ingredientsRealtime.publish(
    "corrected",
    { ingredientIds: [ingredientId] },
    { householdKey: member.householdKey }
  );
}

/**
 * Save a member's correction to an Ingredient, which becomes the household's.
 * Refused where it names a dataset food Norish does not have, corrects
 * nothing, or the Ingredient is gone.
 */
export async function correctNutrition(
  member: CorrectingMember,
  ingredientId: string,
  input: NutritionCorrectionInput
): Promise<void> {
  const foods = [foodOf(input.numbers), foodOf(input.pieceWeight), foodOf(input.density)].filter(
    (key): key is string => key !== null
  );

  if (!input.numbers && !input.pieceWeight && !input.density) {
    throw new NutritionCorrectionError("empty");
  }
  if (foods.length > 0) {
    const known = new Set((await findNutritionFoods(foods)).map((food) => `${food.dataset}:${food.code}`));

    if (foods.some((key) => !known.has(key))) throw new NutritionCorrectionError("unknown-food");
  }

  const numbers = input.numbers && !("food" in input.numbers) ? input.numbers : null;
  const piece = input.pieceWeight && !("food" in input.pieceWeight) ? input.pieceWeight : null;
  const density = input.density && !("food" in input.density) ? input.density : null;
  const values: NutritionCorrectionValues = {
    numbersFood: foodOf(input.numbers),
    kcal: numbers?.kcal ?? null,
    fat: numbers?.fat ?? null,
    carbs: numbers?.carbs ?? null,
    protein: numbers?.protein ?? null,
    pieceWeightFood: foodOf(input.pieceWeight),
    pieceWeight: piece?.grams ?? null,
    densityFood: foodOf(input.density),
    density: density?.gramsPerMl ?? null,
  };

  if (!(await saveNutritionCorrection(member.userId, ingredientId, values))) {
    throw new NutritionCorrectionError("not-found");
  }
  await announce(member, ingredientId);
}

/** Remove the household's correction to an Ingredient: every member's, back to the sources. */
export async function removeNutritionCorrection(
  member: CorrectingMember,
  ingredientId: string
): Promise<void> {
  await removeHouseholdCorrections(ingredientId, member.householdUserIds);
  await announce(member, ingredientId);
}

/** How many dataset foods a search answers with. */
const SEARCH_LIMIT = 20;

/**
 * Dataset foods to correct a number with, found by the words of their names
 * in the dataset's own language: "milk semi skimmed" finds "Milk,
 * semi-skimmed, UHT". Every word must be in the name.
 */
export async function searchDatasetFoods(
  text: string
): Promise<Array<NutritionFoodRef & { kcal: number; pieceWeight: number | null; density: number | null }>> {
  const words = foldName(text)
    .split(" ")
    .filter((word) => word.length > 1);
  const found = await searchNutritionFoods(words, SEARCH_LIMIT);

  return found.map((food) => ({
    dataset: food.dataset as NutritionFoodRef["dataset"],
    code: food.code,
    name: food.name,
    kcal: food.kcal,
    pieceWeight: food.pieceWeight,
    density: food.density,
  }));
}
