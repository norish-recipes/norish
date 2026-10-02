/**
 * The scenarios a recipe's worked-out nutrition was argued through, as one
 * table (ADR-0039): a line reaches grams by its weight, by the Ingredient's
 * piece weight when counted, or by its density when measured by volume; a
 * pinch, a dash or "to taste" counts as nothing; anything else is left out
 * of the total and named beneath it.
 */
import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type {
  IngredientNutrition,
  NutritionFact,
  NutritionSource,
  Per100g,
} from "@norish/shared/contracts/ingredient-nutrition";
import type { NutritionLine } from "@norish/shared/lib/recipe-nutrition";
import defaultUnits from "@norish/config/units.default.json";
import {
  lineKey,
  nutritionLinesOf,
  seasoningPhrases,
  suppliesNutrition,
  workOutNutrition,
} from "@norish/shared/lib/recipe-nutrition";

const ciqual = (name: string): NutritionSource => ({
  kind: "code",
  food: { dataset: "ciqual", code: "1", name },
});
const fact = <T>(
  value: T,
  source: NutritionSource,
  borrowedFrom: string | null = null
): NutritionFact<T> => ({
  value,
  source,
  borrowedFrom: borrowedFrom ? { id: borrowedFrom, name: borrowedFrom } : null,
});
const per100g = (kcal: number, fat: number, carbs: number, protein: number): Per100g => ({
  kcal,
  fat,
  carbs,
  protein,
});

const NUTRITION = new Map<string, IngredientNutrition>([
  [
    "onion",
    {
      numbers: fact(per100g(40, 0, 10, 1), ciqual("Onion, raw")),
      pieceWeight: fact(150, { kind: "taxonomy" }),
      density: null,
    },
  ],
  [
    "red-onion",
    {
      numbers: fact(per100g(40, 0, 10, 1), ciqual("Onion, raw"), "onion"),
      pieceWeight: fact(150, { kind: "taxonomy" }, "onion"),
      density: null,
    },
  ],
  [
    "rice",
    {
      numbers: fact(per100g(350, 1, 78, 7), ciqual("Rice, raw")),
      pieceWeight: null,
      density: null,
    },
  ],
  [
    "garlic",
    {
      numbers: fact(per100g(100, 0, 20, 5), ciqual("Garlic, raw")),
      pieceWeight: fact(3, {
        kind: "code",
        food: { dataset: "usda", code: "2", name: "Garlic, raw" },
      }),
      density: null,
    },
  ],
  [
    "milk",
    {
      numbers: fact(per100g(64, 3.5, 4.8, 3.4), {
        kind: "fix",
        food: { dataset: "ciqual", code: "3", name: "Milk" },
      }),
      pieceWeight: null,
      density: fact(1, { kind: "taxonomy" }),
    },
  ],
  [
    "olive-oil",
    {
      numbers: fact(per100g(900, 100, 0, 0), ciqual("Olive oil")),
      pieceWeight: null,
      density: fact(0.9, { kind: "taxonomy" }),
    },
  ],
  [
    "flour",
    {
      numbers: fact(per100g(350, 1, 75, 10), ciqual("Wheat flour")),
      pieceWeight: null,
      density: null,
    },
  ],
  ["brandy", { numbers: null, pieceWeight: null, density: null }],
  [
    "salt",
    { numbers: fact(per100g(0, 0, 0, 0), ciqual("Salt")), pieceWeight: null, density: null },
  ],
]);

let order = 0;

function line(
  amount: number | null,
  unit: string | null,
  ingredientId: string | null,
  name = ingredientId ?? "?"
): NutritionLine {
  order += 1;

  return { id: `line-${order}`, name, amount, unit, ingredientId };
}

const phrases = seasoningPhrases(defaultUnits as UnitsMap);

function workOut(lines: NutritionLine[], servings: number | null = 1) {
  return workOutNutrition({ lines, servings, nutrition: NUTRITION, seasoning: phrases });
}

describe("workOutNutrition", () => {
  it("sums weight lines and divides by the servings: 200 g onion and 500 g rice for four", () => {
    expect(workOut([line(200, "gram", "onion"), line(500, "gram", "rice")], 4)).toMatchObject({
      perServing: {
        calories: (80 + 1750) / 4,
        fat: (0 + 5) / 4,
        carbs: (20 + 390) / 4,
        protein: (2 + 35) / 4,
      },
      uncounted: [],
      estimated: false,
    });
  });

  it.each([
    ["kilograms", line(0.5, "kilogram", "rice"), 1750],
    ["ounces", line(4, "ounce", "rice"), 4 * 28.349523 * 3.5],
    ["pounds", line(1, "lb", "rice"), 453.59237 * 3.5],
    ["pieces, no unit", line(2, null, "onion"), 2 * 150 * 0.4],
    ["pieces, named", line(2, "piece", "onion"), 2 * 150 * 0.4],
    ["cloves", line(3, "clove", "garlic"), 3 * 3 * 1],
    ["chunks, as a stuk was stored before it named a piece", line(2, "chunk", "onion"), 120],
    ["a cup through its density", line(1, "cup", "milk"), 240 * 0.64],
    ["tablespoons through their density", line(2, "tablespoon", "olive-oil"), 2 * 15 * 0.9 * 9],
    ["millilitres through their density", line(100, "milliliter", "milk"), 64],
  ])("counts %s", (_, counted, calories) => {
    expect(workOut([counted]).perServing?.calories).toBeCloseTo(calories, 5);
  });

  it.each([
    ["a pinch", line(1, "pinch", "salt", "nutmeg")],
    ["a dash", line(1, "dash", "salt", "tabasco")],
    ["to taste", line(null, "to_taste", "salt", "salt")],
    ["salt to taste, written in the name", line(null, null, "salt", "salt to taste")],
    ["a pinch, written in the name", line(null, null, "salt", "a pinch of salt")],
  ])("counts %s as nothing, and does not list it", (_, seasoning) => {
    const result = workOut([line(100, "gram", "rice"), seasoning]);

    expect(result.perServing?.calories).toBe(350);
    expect(result.uncounted).toEqual([]);
  });

  it.each([
    ["no amount", line(null, null, "olive-oil", "olive oil for frying")],
    ["a unit that reaches no grams", line(1, "can", "onion", "tomatoes")],
    ["a volume with no density", line(1, "cup", "flour", "flour")],
    ["no numbers", line(50, "milliliter", "brandy", "brandy")],
    ["no Ingredient", line(100, "gram", null, "mystery")],
    ["a count with no piece weight", line(2, null, "rice", "rice")],
  ])("names a line with %s under Not counted, and still shows the total", (_, uncounted) => {
    const result = workOut([line(100, "gram", "rice"), uncounted]);

    expect(result.perServing?.calories).toBe(350);
    expect(result.uncounted).toEqual([
      {
        lineId: uncounted.id,
        name: uncounted.name,
        ingredientId: uncounted.ingredientId,
        key: lineKey(uncounted),
      },
    ]);
  });

  it("shows no total where no line counts, rather than a zero", () => {
    expect(
      workOut([line(1, "cup", "flour"), line(null, null, "olive-oil"), line(1, "pinch", "salt")])
        .perServing
    ).toBeNull();
  });

  it("is estimated where a counted line borrowed its numbers or its piece weight, and only then", () => {
    expect(workOut([line(100, "gram", "red-onion")]).estimated).toBe(true);
    expect(workOut([line(1, null, "red-onion")]).estimated).toBe(true);
    expect(workOut([line(100, "gram", "onion"), line(2, null, "onion")]).estimated).toBe(false);
    // A borrowing line left out of the total does not make it estimated.
    expect(workOut([line(100, "gram", "onion"), line(1, "can", "red-onion")]).estimated).toBe(
      false
    );
  });

  it("credits only the datasets the counted lines used", () => {
    expect(workOut([line(2, null, "onion"), line(1, "cup", "flour")]).credits).toEqual([
      "ciqual",
      "off",
    ]);
    expect(workOut([line(3, "clove", "garlic")]).credits).toEqual(["ciqual", "usda"]);
  });

  it("says where a household's own numbers went into the total", () => {
    const corrected = new Map(NUTRITION);

    corrected.set("rice", {
      numbers: fact(per100g(360, 1, 80, 7), { kind: "household" }),
      pieceWeight: null,
      density: null,
    });

    expect(
      workOutNutrition({
        lines: [line(100, "gram", "rice")],
        servings: 1,
        nutrition: corrected,
        seasoning: phrases,
      })
    ).toMatchObject({ perServing: { calories: 360 }, credits: [], household: true });
  });

  describe("with the language model's estimate of the lines left out", () => {
    const oil = line(null, null, "olive-oil", "olive oil for frying");
    const brandy = line(50, "milliliter", "brandy", "brandy");
    const share = (of: NutritionLine, calories: number, fat: number) => ({
      key: lineKey(of),
      calories,
      fat,
      carbs: 1,
      protein: 0,
    });
    const estimate = { lines: [share(oil, 90, 10), share(brandy, 10, 0)] };

    it("adds each line's share where it covers the lines left out, and names them as its own", () => {
      const result = workOutNutrition({
        lines: [line(100, "gram", "rice"), oil, brandy],
        servings: 2,
        nutrition: NUTRITION,
        seasoning: phrases,
        estimate,
      });

      expect(result).toMatchObject({
        perServing: { calories: 175 + 100, fat: 0.5 + 10 },
        uncounted: [],
        estimated: true,
      });
      expect(result.estimatedByAI.map((named) => named.name)).toEqual([
        "olive oil for frying",
        "brandy",
      ]);
    });

    it("is the whole total where no line counted", () => {
      expect(
        workOutNutrition({
          lines: [oil],
          servings: 1,
          nutrition: NUTRITION,
          seasoning: phrases,
          estimate: { lines: [share(oil, 100, 10)] },
        }).perServing
      ).toEqual({ calories: 100, fat: 10, carbs: 1, protein: 0 });
    });

    it("keeps the other lines' shares once a household's correction counts one of them", () => {
      const corrected = new Map(NUTRITION);

      corrected.set("brandy", {
        numbers: fact(per100g(230, 0, 0, 0), { kind: "household" }),
        pieceWeight: null,
        density: fact(1, { kind: "household" }),
      });

      const result = workOutNutrition({
        lines: [line(100, "gram", "rice"), oil, brandy],
        servings: 1,
        nutrition: corrected,
        seasoning: phrases,
        estimate,
      });

      // Rice from the datasets, brandy from the household, the oil from the model.
      expect(result.perServing?.calories).toBe(350 + 50 * 2.3 + 90);
      expect(result.estimatedByAI.map((named) => named.name)).toEqual(["olive oil for frying"]);
      expect(result.uncounted).toEqual([]);
      expect(result.household).toBe(true);
    });

    it("lists a line the estimate never covered, or one edited since, as not counted", () => {
      const more = line(2, "tablespoon", "brandy", "brandy");
      const result = workOutNutrition({
        lines: [line(100, "gram", "rice"), oil, more],
        servings: 1,
        nutrition: NUTRITION,
        seasoning: phrases,
        estimate,
      });

      expect(result.perServing?.calories).toBe(350 + 90);
      expect(result.estimatedByAI.map((named) => named.name)).toEqual(["olive oil for frying"]);
      expect(result.uncounted.map((named) => named.name)).toEqual(["brandy"]);
    });
  });

  it("tells what each counted line brought to the total", () => {
    expect(workOut([line(200, "gram", "onion", "200 g onion")]).counted).toEqual([
      {
        lineId: expect.any(String),
        name: "200 g onion",
        grams: 200,
        calories: 80,
        fat: 0,
        carbs: 20,
        protein: 2,
      },
    ]);
  });

  it("reads a recipe without servings as one serving", () => {
    expect(workOut([line(100, "gram", "rice")], null).perServing?.calories).toBe(350);
    expect(workOut([line(100, "gram", "rice")], 0).perServing?.calories).toBe(350);
  });
});

describe("a recipe's lines and supplied numbers", () => {
  const recipe = {
    servings: 2,
    systemUsed: "metric",
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
    recipeIngredients: [
      {
        id: "a",
        ingredientName: "# For the sauce",
        ingredientId: null,
        amount: null,
        unit: null,
        systemUsed: "metric",
      },
      {
        id: "b",
        ingredientName: "200 g onion",
        ingredientId: "onion",
        amount: "200",
        unit: "gram",
        systemUsed: "metric",
      },
      {
        id: "c",
        ingredientName: "7 oz onion",
        ingredientId: "onion",
        amount: 7,
        unit: "ounce",
        systemUsed: "us",
      },
    ],
  };

  it("works out from the recipe's own measurement system, without its headings", () => {
    expect(nutritionLinesOf(recipe)).toEqual([
      { id: "b", name: "200 g onion", amount: 200, unit: "gram", ingredientId: "onion" },
    ]);
  });

  it("takes any value the recipe supplies as the whole group, and works nothing out beside it", () => {
    expect(suppliesNutrition(recipe)).toBe(false);
    expect(suppliesNutrition({ ...recipe, calories: 320 })).toBe(true);
    expect(suppliesNutrition({ ...recipe, fat: "12.5" })).toBe(true);
    expect(suppliesNutrition({ ...recipe, fat: "" })).toBe(false);
  });
});
