/**
 * The scenarios a recipe's worked-out nutrition was argued through, as one
 * table (ADR-0039): a line reaches grams by its weight, by the Ingredient's
 * piece weight when counted, or by its density when measured by volume;
 * anything else is left out of the total and named with why, a pinch, a dash
 * or "to taste" as seasoning.
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
  bracketedGrams,
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
  [
    "paprika",
    {
      numbers: fact(per100g(282, 13, 54, 14), ciqual("Paprika, powder")),
      pieceWeight: null,
      density: fact(0.45, ciqual("Spices"), "spice"),
    },
  ],
  [
    "pastry-flour",
    {
      numbers: fact(per100g(350, 1, 75, 10), ciqual("Wheat flour")),
      pieceWeight: null,
      density: fact(0.6, { kind: "taxonomy" }, "flour"),
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
      leftOut: [],
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
    ["a generous pinch", line(1, "generous_pinch", "salt", "salt")],
    ["a knife tip", line(1, "knife_tip", "salt", "nutmeg")],
    ["to taste", line(null, "to_taste", "salt", "salt")],
    ["salt to taste, written in the name", line(null, null, "salt", "salt to taste")],
    ["a pinch, written in the name", line(null, null, "salt", "a pinch of salt")],
  ])("lists %s as seasoning, and never counts it", (_, seasoning) => {
    const result = workOut([line(100, "gram", "rice"), seasoning]);

    expect(result.perServing?.calories).toBe(350);
    expect(result.leftOut).toEqual([
      {
        lineId: seasoning.id,
        name: seasoning.name,
        ingredientId: seasoning.ingredientId,
        key: lineKey(seasoning),
        reason: "seasoning",
        estimatedByAI: false,
      },
    ]);
  });

  it.each([
    ["no amount", line(null, null, "olive-oil", "olive oil for frying"), "no-amount"],
    ["a measure with no size", line(1, "can", "onion", "tomatoes"), "no-size"],
    ["a volume with no density", line(1, "cup", "flour", "flour"), "no-spoon-weight"],
    ["no numbers", line(50, "milliliter", "brandy", "brandy"), "no-numbers"],
    ["no Ingredient", line(100, "gram", null, "mystery"), "no-numbers"],
    ["a count with no piece weight", line(2, null, "rice", "rice"), "no-piece-weight"],
  ])("leaves out a line with %s, saying so, and still shows the total", (_, leftOut, reason) => {
    const result = workOut([line(100, "gram", "rice"), leftOut]);

    expect(result.perServing?.calories).toBe(350);
    expect(result.leftOut).toEqual([
      {
        lineId: leftOut.id,
        name: leftOut.name,
        ingredientId: leftOut.ingredientId,
        key: lineKey(leftOut),
        reason,
        estimatedByAI: false,
      },
    ]);
  });

  it("names the first thing that stops a line: its amount, then its measure, then its food", () => {
    const reasons = workOut([
      line(null, "cup", "brandy", "brandy, a splash"),
      line(1, "can", "brandy", "a can of brandy"),
      line(1, "cup", "brandy", "a cup of brandy"),
      line(1, "cup", "flour", "a cup of flour"),
    ]).leftOut.map((named) => named.reason);

    expect(reasons).toEqual(["no-amount", "no-size", "no-numbers", "no-spoon-weight"]);
  });

  it("takes the weight a line's brackets state where nothing else weighs it", () => {
    const worked = workOut([
      // A container holds it, each piece weighs it, a measure weighs it whole.
      line(1, "can", "rice", "(400 g) rice"),
      line(2, null, "rice", "(8 ounce) rice cakes"),
      line(2, "tablespoon", "flour", "flour (30 g)"),
      // A volume in brackets is no weight.
      line(1, "cup", "flour", "flour (400 ml)"),
    ]);

    expect(worked.counted.map((counted) => Math.round(counted.grams))).toEqual([400, 454, 30]);
    expect(worked.leftOut.map((named) => named.reason)).toEqual(["no-spoon-weight"]);
  });

  it("weighs a counted line by its food's piece weight before its brackets", () => {
    expect(workOut([line(1, null, "onion", "(200 g) onion")]).counted[0]!.grams).toBe(150);
  });

  it("reads a unit an older import left at the start of a unitless line's text", () => {
    const worked = workOut([
      line(150, null, "rice", "GR rice"),
      line(150, "", "rice", "gram rice"),
      line(2, null, "flour", "TBSP flour"),
      // A count or a container there is the food's words, and the line counts pieces.
      line(2, null, "onion", "stuks onion"),
    ]);

    expect(worked.counted.map((counted) => counted.grams)).toEqual([150, 150, 300]);
    expect(worked.leftOut.map((named) => named.reason)).toEqual(["no-spoon-weight"]);
  });

  it("counts a size word stored as the unit as one piece", () => {
    expect(workOut([line(2, "large", "onion", "onions")]).counted[0]!.grams).toBe(300);
    expect(workOut([line(1, "Medium", "onion", "onion")]).counted[0]!.grams).toBe(150);
  });

  it("names every line left out in the recipe's order, seasoning among them", () => {
    const names = workOut([
      line(1, "pinch", "salt", "a pinch of salt"),
      line(100, "gram", "rice", "rice"),
      line(1, "cup", "flour", "flour"),
      line(null, "to_taste", "salt", "pepper to taste"),
    ]).leftOut.map((named) => named.name);

    expect(names).toEqual(["a pinch of salt", "flour", "pepper to taste"]);
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

  it("is estimated only where the lines that borrowed bring a tenth of its calories", () => {
    // A borrowed teaspoon of paprika (5 ml at 0.45 g/ml, 6 kcal) in a 2,000 kcal recipe.
    expect(
      workOut([
        line(1, "teaspoon", "paprika"),
        line(500, "gram", "rice"),
        line(30, "gram", "olive-oil"),
      ]).estimated
    ).toBe(false);
    // A cup of flour on a borrowed density: 144 g, 504 kcal of the 2,254.
    expect(workOut([line(1, "cup", "pastry-flour"), line(500, "gram", "rice")]).estimated).toBe(
      true
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
        estimated: true,
      });
      expect(result.leftOut.map((named) => [named.name, named.estimatedByAI])).toEqual([
        ["olive oil for frying", true],
        ["brandy", true],
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
      expect(result.leftOut.map((named) => [named.name, named.estimatedByAI])).toEqual([
        ["olive oil for frying", true],
      ]);
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
      expect(result.leftOut.map((named) => [named.name, named.estimatedByAI])).toEqual([
        ["olive oil for frying", true],
        ["brandy", false],
      ]);
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

describe("bracketedGrams", () => {
  it("reads the first weight a text states in brackets, in grams", () => {
    expect(bracketedGrams("(15 ounce) can coconut milk")).toBeCloseTo(425.24, 1);
    expect(bracketedGrams("chicken breast (about 1 lb.)")).toBeCloseTo(453.59, 1);
    expect(bracketedGrams("(~8 ounce) chicken breasts")).toBeCloseTo(226.8, 1);
    expect(bracketedGrams("mixed seeds (30g (pumpkin seeds, sunflower seeds))")).toBe(30);
    expect(bracketedGrams("(.25 ounce) package active dry yeast")).toBeCloseTo(7.09, 1);
    expect(bracketedGrams("boter (1,5 kg)")).toBe(1500);
  });

  it("reads no weight from a volume, a count or a bracket without a number", () => {
    expect(bracketedGrams("kokosmelk (400 ml)")).toBeNull();
    expect(bracketedGrams("coconut milk (15 fl oz)")).toBeNull();
    expect(bracketedGrams("(4) zoete aardappelen")).toBeNull();
    expect(bracketedGrams("onions (red)")).toBeNull();
  });
});
