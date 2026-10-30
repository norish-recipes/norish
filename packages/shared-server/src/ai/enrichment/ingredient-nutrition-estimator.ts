/**
 * AI's estimate of a food's missing facts (Fill Gaps), its numbers per 100 g, density and piece
 * weight, in one request asking only for those wanted; not an AI Change, no Decision Model check.
 */
import { z } from "zod";

import type { Per100g } from "@norish/shared/contracts/ingredient-nutrition";

import { generateStructured } from "../runtime/runtime";

/** A food as it is asked about: its name and what it is a kind of, nearest first. */
export interface FoodToEstimate {
  name: string;
  kindOf: readonly string[];
}

/** Which facts are asked for. */
export interface FactsWanted {
  numbers: boolean;
  pieceWeight: boolean;
  density: boolean;
}

/** What AI answered, for the facts asked; a null piece weight says it is not counted in pieces. */
export interface EstimatedFacts {
  numbers?: Per100g;
  pieceWeight?: number | null;
  density?: number;
}

const grams = (what: string) => z.number().min(0).describe(`${what} per 100 g, in grams.`);

const FACT_SCHEMAS = {
  per100g: z
    .object({
      kcal: z
        .number()
        .min(0)
        .describe("Calories per 100 g, about fat * 9 + carbohydrates * 4 + protein * 4."),
      fat: grams("Fat"),
      carbs: grams("Carbohydrates"),
      protein: grams("Protein"),
    })
    .strict(),
  gramsPerPiece: z
    .number()
    .positive()
    .nullable()
    .describe("What one piece weighs in grams, as it is usually counted; null when it is not."),
  gramsPerMl: z
    .number()
    .positive()
    .describe("Grams per millilitre, as it is measured by the spoon or the cup."),
} as const;

/** The answer, read back: every fact optional, since only the wanted ones were asked. */
const answerSchema = z.object({
  per100g: FACT_SCHEMAS.per100g.optional(),
  gramsPerPiece: FACT_SCHEMAS.gramsPerPiece.optional(),
  gramsPerMl: FACT_SCHEMAS.gramsPerMl.optional(),
});

function sections(food: FoodToEstimate, wanted: FactsWanted): string[] {
  const asked = [
    ...(wanted.numbers ? ["calories, fat, carbohydrates and protein per 100 g"] : []),
    ...(wanted.density ? ["grams per millilitre"] : []),
    ...(wanted.pieceWeight ? ["what one piece weighs"] : []),
  ];

  return [
    `Food: ${food.name}`,
    ...(food.kindOf.length > 0 ? [`A kind of: ${food.kindOf.join(", ")}`] : []),
    `Estimate only: ${asked.join("; ")}`,
  ];
}

/** Ask AI for a food's wanted facts. Throws whatever the runtime throws. */
export async function estimateFoodFacts(
  food: FoodToEstimate,
  wanted: FactsWanted
): Promise<EstimatedFacts> {
  const schema = z
    .object({
      ...(wanted.numbers ? { per100g: FACT_SCHEMAS.per100g } : {}),
      ...(wanted.pieceWeight ? { gramsPerPiece: FACT_SCHEMAS.gramsPerPiece } : {}),
      ...(wanted.density ? { gramsPerMl: FACT_SCHEMAS.gramsPerMl } : {}),
    })
    .strict();
  const output = answerSchema.parse(
    await generateStructured({
      prompt: "ingredient-nutrition",
      schema,
      sections: sections(food, wanted),
    })
  );

  return {
    ...(output.per100g ? { numbers: output.per100g } : {}),
    ...(output.gramsPerPiece !== undefined ? { pieceWeight: output.gramsPerPiece } : {}),
    ...(output.gramsPerMl !== undefined ? { density: output.gramsPerMl } : {}),
  };
}
