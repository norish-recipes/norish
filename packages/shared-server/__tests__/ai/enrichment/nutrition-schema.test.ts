/**
 * @vitest-environment node
 */
import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";

import {
  nutritionEstimationSchema,
  nutritionGapEstimationSchema,
} from "@norish/shared-server/ai/enrichment/nutrition.schema";

const FOUR = { calories: 420, fat: 9, carbs: 68, protein: 15 };
const EXTRAS = ["saturatedFat", "sugars", "fiber", "sodium"];

describe("a language model's nutrition answer without the other nutrients", () => {
  it("still counts the four, with the others unknown", () => {
    const unknown = { saturatedFat: null, sugars: null, fiber: null, sodium: null };

    expect(nutritionEstimationSchema.parse(FOUR)).toEqual({ ...FOUR, ...unknown });
    expect(nutritionGapEstimationSchema.parse({ lines: [{ line: 1, ...FOUR }] })).toEqual({
      lines: [{ line: 1, ...FOUR, ...unknown }],
    });
  });

  it("keeps the ones it gives", () => {
    expect(nutritionEstimationSchema.parse({ ...FOUR, fiber: 7 })).toMatchObject({ fiber: 7 });
  });

  it("still refuses an answer missing one of the four", () => {
    expect(nutritionEstimationSchema.safeParse({ fat: 9, carbs: 68, protein: 15 }).success).toBe(
      false
    );
  });

  it("asks for every one of them, as strict structured outputs need", async () => {
    const { required } = (await zodSchema(nutritionEstimationSchema).jsonSchema) as {
      required: string[];
    };

    expect(required).toEqual(expect.arrayContaining(["calories", ...EXTRAS]));
  });
});
