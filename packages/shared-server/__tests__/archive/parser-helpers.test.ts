// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  buildRecipeDTO,
  parseHumanDurationToMinutes,
} from "@norish/shared-server/archive/parser-helpers";

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

vi.mock("@norish/shared/lib/helpers", async (importOriginal) => {
  const original = await importOriginal<typeof import("@norish/shared/lib/helpers")>();

  return {
    ...original,
    parseIngredientWithDefaults: vi.fn((lines: string | string[]) =>
      [lines].flat().map((line) => ({
        quantity: null,
        unitOfMeasureID: null,
        description: line.includes("Header") ? "" : line,
        isGroupHeader: false,
      }))
    ),
  };
});

describe("parseHumanDurationToMinutes", () => {
  it.each([
    ["1 hr 30 min", 90],
    ["1h30m", 90],
    ["90 minutes", 90],
    ["2 hours", 120],
    ["12h", 720],
    ["45 Mins", 45],
    ["1:30", 90],
    ["medium heat", undefined],
    ["", undefined],
  ])("reads %j as %j", (text, minutes) => {
    expect(parseHumanDurationToMinutes(text)).toBe(minutes);
  });

  // A field of digits was rescanned from every position, quadratic in its length.
  it("reads a long run of digits in linear time", () => {
    expect(parseHumanDurationToMinutes("1".repeat(200_000))).toBeUndefined();
  });
});

describe("buildRecipeDTO", () => {
  it("filters parsed ingredients with empty names", async () => {
    const dto = await buildRecipeDTO({
      name: "Header Recipe",
      ingredientsText: "1 cup quinoa\nHeader section",
      instructionsText: "Mix well",
    });
    const ingredients = dto.recipeIngredients || [];

    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]?.ingredientName).toBe("1 cup quinoa");
  });
});
