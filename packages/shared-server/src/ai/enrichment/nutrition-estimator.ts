import { aiLogger } from "@norish/shared-server/logger";

import type { NutritionEstimate } from "./nutrition.schema";
import type { ValidationMode } from "./verification";
import { AIResponseError } from "../runtime/errors";
import { generateStructured } from "../runtime/runtime";
import { nutritionEstimationSchema, nutritionGapEstimationSchema } from "./nutrition.schema";
import { verifyClaims } from "./verification";

/**
 * Whether an estimate the Decision Model finds out of reason fails the run
 * so the queue asks the language model again. Shadow until the disagreement
 * rate is known; the group is atomic, so a failed run writes nothing rather
 * than half a group. Promotion is this one constant, with the rate.
 */
const NUTRITION_VALIDATION_MODE: ValidationMode = "shadow";

// Re-export type for consumers
export type { NutritionEstimate };

export interface IngredientForEstimation {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
}

/** A line a worked-out total left out, with the key its share is stored under (`lineKey`). */
export interface LineForEstimation extends IngredientForEstimation {
  key: string;
}

/** One left-out line's per-serving share, as the estimate stores it. */
export interface EstimatedLineShare {
  key: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

/** A line Ingredient Nutrition already counted, with what it brought for the whole line. */
export interface CountedForEstimation {
  text: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

function rounded(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function lineText(line: IngredientForEstimation): string {
  const parts: string[] = [];

  if (line.amount != null) parts.push(line.amount.toString());
  if (line.unit) parts.push(line.unit);

  parts.push(line.ingredientName);

  return parts.join(" ");
}

/**
 * The lines Ingredient Nutrition already counted, as given facts appended to
 * the prompt (ADR-0016), so the model estimates only the lines left out and
 * a total made of both counts nothing twice (ADR-0039).
 */
function countedSection(counted: readonly CountedForEstimation[]): string {
  return [
    "Already counted:",
    "The recipe also has these lines. Norish has already counted them from food composition data, and their numbers are for the whole line, not per serving. Do not include them in your estimate: estimate only the ingredients listed above, per serving.",
    ...counted.map(
      (line) =>
        `- ${line.text}: ${rounded(line.calories)} kcal, ${rounded(line.fat)} g fat, ${rounded(line.carbs)} g carbohydrates, ${rounded(line.protein)} g protein`
    ),
  ].join("\n");
}

/** How the estimate of the lines left out is wanted: each numbered line's own share. */
const PER_LINE_SECTION = [
  "Per ingredient:",
  "The ingredients above are numbered. Give each one its own per-serving share, under its number: the four values of an entry are what that ingredient alone contributes to one serving. Include every number once.",
].join("\n");

/**
 * The estimate, checked before it is written (Enrichment Validation): one
 * question per figure, on the same ingredient list the model estimated
 * from. Throws, for a retry, where a disputed figure is enforced.
 */
async function verifyEstimate(
  recipeName: string,
  servings: number,
  ingredientLines: string[],
  figures: { calories: number; fat: number; carbs: number; protein: number },
  what: string
): Promise<void> {
  const { dropped, mode } = await verifyClaims({
    feature: "nutrition-estimation",
    state: { recipeName, servings, ingredients: ingredientLines },
    claims: [
      {
        id: "calories",
        question: `Is ${figures.calories} kcal per serving within reason for ${what}?`,
      },
      {
        id: "fat",
        question: `Is ${figures.fat} g of fat per serving within reason for ${what}?`,
      },
      {
        id: "carbs",
        question: `Is ${figures.carbs} g of carbohydrates per serving within reason for ${what}?`,
      },
      {
        id: "protein",
        question: `Is ${figures.protein} g of protein per serving within reason for ${what}?`,
      },
    ],
    mode: NUTRITION_VALIDATION_MODE,
  });

  if (mode === "enforce" && dropped.length > 0) {
    throw new AIResponseError(
      `The Decision Model finds the estimated ${dropped.map(({ claim }) => claim.id).join(", ")} out of reason; asking again.`
    );
  }
}

/** Estimate a recipe's nutrition per serving, as a whole, from its ingredients. */
export async function estimateNutritionFromIngredients(
  recipeName: string,
  servings: number,
  ingredients: IngredientForEstimation[]
): Promise<NutritionEstimate> {
  if (ingredients.length === 0) {
    throw new Error("No ingredients provided for nutrition estimation");
  }

  aiLogger.info(
    { recipeName, servings, ingredientCount: ingredients.length },
    "Starting nutrition estimation"
  );

  const ingredientsList = ingredients.map((line) => `- ${lineText(line)}`).join("\n");

  const output = await generateStructured({
    prompt: "nutrition-estimation",
    schema: nutritionEstimationSchema,
    fill: {
      recipeName,
      servings: servings.toString(),
      ingredients: ingredientsList,
    },
    sections: [],
  });

  await verifyEstimate(recipeName, servings, ingredientsList.split("\n"), output, "this recipe");

  aiLogger.info(
    {
      recipeName,
      calories: output.calories,
      fat: output.fat,
      carbs: output.carbs,
      protein: output.protein,
    },
    "Nutrition estimation completed"
  );

  return output;
}

/**
 * Estimate the lines a recipe's worked-out total left out (ADR-0039), one
 * per-serving share per line: `lines` are the lines left out, `counted` the
 * rest, given as facts. The model answers under the lines' numbers, and the
 * answer is refused, for a retry, unless every line is there exactly once.
 */
export async function estimateNutritionGap(
  recipeName: string,
  servings: number,
  lines: LineForEstimation[],
  counted: readonly CountedForEstimation[]
): Promise<EstimatedLineShare[]> {
  if (lines.length === 0) {
    throw new Error("No ingredients provided for nutrition estimation");
  }

  aiLogger.info(
    { recipeName, servings, ingredientCount: lines.length, countedCount: counted.length },
    "Starting nutrition estimation of the lines left out"
  );

  const ingredientsList = lines.map((line, i) => `${i + 1}. ${lineText(line)}`).join("\n");

  const output = await generateStructured({
    prompt: "nutrition-estimation",
    schema: nutritionGapEstimationSchema,
    fill: {
      recipeName,
      servings: servings.toString(),
      ingredients: ingredientsList,
    },
    sections: [PER_LINE_SECTION, ...(counted.length > 0 ? [countedSection(counted)] : [])],
  });

  const numbers = output.lines.map((entry) => entry.line).sort((a, b) => a - b);

  if (numbers.length !== lines.length || numbers.some((n, i) => n !== i + 1)) {
    throw new AIResponseError(
      `The estimate names lines ${numbers.join(", ")} where ${lines.length} were asked about; asking again.`
    );
  }

  const shares = output.lines.map(({ line, ...figures }) => ({
    key: lines[line - 1]!.key,
    ...figures,
  }));
  const total = shares.reduce(
    (sum, share) => ({
      calories: sum.calories + share.calories,
      fat: sum.fat + share.fat,
      carbs: sum.carbs + share.carbs,
      protein: sum.protein + share.protein,
    }),
    { calories: 0, fat: 0, carbs: 0, protein: 0 }
  );

  await verifyEstimate(
    recipeName,
    servings,
    ingredientsList.split("\n"),
    total,
    "these ingredients of the recipe"
  );

  aiLogger.info(
    { recipeName, lines: shares.length, ...total },
    "Nutrition estimation of the lines left out completed"
  );

  return shares;
}
