/**
 * Converting measurements without a language model (#599): a weight stays a
 * weight and a volume a volume, except where the food's density and whether
 * it is poured decide otherwise, rounded to what a kitchen measures.
 */
import { describe, expect, it } from "vitest";

import { convertMeasure, convertStepText } from "@norish/shared/lib/measurement-conversion";

const flour = { density: 0.52, poured: false };
const milk = { density: 1.02, poured: true };
const butter = { density: 0.95, poured: false };
const salt = { density: 1.22, poured: false };

describe("convertMeasure to metric", () => {
  it.each([
    ["2 cups of flour weigh", 2, "cup", flour, { amount: 250, unit: "gram" }],
    ["a cup of milk is poured", 1, "cup", milk, { amount: 240, unit: "milliliter" }],
    ["a cup of an unknown food is a volume", 1, "cup", null, { amount: 240, unit: "milliliter" }],
    ["half a cup of butter weighs", 0.5, "cup", butter, { amount: 115, unit: "gram" }],
    ["a pound", 1, "pound", null, { amount: 455, unit: "gram" }],
    ["three pounds", 3, "lb", null, { amount: 1.36, unit: "kg" }],
    ["8 ounces", 8, "ounce", null, { amount: 225, unit: "gram" }],
    ["a quarter ounce", 0.25, "oz", null, { amount: 7.1, unit: "gram" }],
    ["5 cups of water", 5, "cup", null, { amount: 1.2, unit: "liter" }],
    ["a fluid ounce", 1, "fl oz", milk, { amount: 30, unit: "milliliter" }],
  ])("%s", (_, amount, unit, food, expected) => {
    expect(convertMeasure(amount, unit, "metric", food)).toEqual(expected);
  });

  it.each([
    ["a spoon, both systems'", 1, "tablespoon"],
    ["a teaspoon", 2, "tsp"],
    ["grams already", 500, "gram"],
    ["a count", 2, "clove"],
    ["a piece", 3, "piece"],
    ["no amount", 0, "cup"],
  ])("leaves %s as written", (_, amount, unit) => {
    expect(convertMeasure(amount, unit, "metric", flour)).toBeNull();
  });
});

describe("convertMeasure to US", () => {
  it.each([
    [
      "500 g of a weighed food is a pound",
      500,
      "gram",
      { density: 0.6, poured: false },
      { amount: 1, unit: "pound" },
    ],
    ["250 g of flour stays a weight", 250, "gram", flour, { amount: 9, unit: "ounce" }],
    ["a spoonful's weight of salt is spooned", 5, "gram", salt, { amount: 0.75, unit: "teaspoon" }],
    ["15 g of butter is a tablespoon", 15, "gram", butter, { amount: 1, unit: "tablespoon" }],
    ["a weight of milk is poured", 200, "gram", milk, { amount: 0.75, unit: "cup" }],
    [
      "a weight of an unknown food stays a weight",
      20,
      "gram",
      null,
      { amount: 0.75, unit: "ounce" },
    ],
    ["250 ml is a cup", 250, "milliliter", null, { amount: 1, unit: "cup" }],
    ["150 ml is two thirds of a cup", 150, "ml", null, { amount: 0.667, unit: "cup" }],
    ["30 ml is 2 tablespoons", 30, "milliliter", null, { amount: 2, unit: "tablespoon" }],
    ["10 ml is 2 teaspoons", 10, "ml", null, { amount: 2, unit: "teaspoon" }],
    ["a litre", 1, "liter", null, { amount: 4, unit: "cup" }],
    ["a kilo", 1, "kg", null, { amount: 2.25, unit: "pound" }],
  ])("%s", (_, amount, unit, food, expected) => {
    expect(convertMeasure(amount, unit, "us", food)).toEqual(expected);
  });

  it.each([
    ["a cup already", 1, "cup"],
    ["a spoon", 1, "tablespoon"],
    ["ounces already", 8, "ounce"],
    ["a few grams of a food with no density", 2, "gram"],
  ])("leaves %s as written", (_, amount, unit) => {
    expect(convertMeasure(amount, unit, "us", null)).toBeNull();
  });
});

describe("convertStepText", () => {
  it.each([
    ["Bake at 350°F for 25 minutes.", "Bake at 175°C for 25 minutes."],
    ["Preheat the oven to 350 degrees.", "Preheat the oven to 175°C."],
    ["Heat to 425 degrees F (220 degrees C).", "Heat to 220°C (220 degrees C)."],
    ["Add 2 cups of broth.", "Add 480 ml of broth."],
    ["Stir in 1 1/2 cups milk and ½ cup sugar.", "Stir in 360 ml milk and 120 ml sugar."],
    ["Add 8 oz cream cheese", "Add 225 g cream cheese"],
    ["Pour in 4 fl oz water", "Pour in 120 ml water"],
    ["Add 2-3 cups water", "Add 2-3 cups water"],
    ["Add 2 tbsp oil", "Add 2 tbsp oil"],
    ["Cut into 2 cm pieces", "Cut into 2 cm pieces"],
    ["Bake at 180°C", "Bake at 180°C"],
  ])("to metric: %s", (text, expected) => {
    expect(convertStepText(text, "metric")).toBe(expected);
  });

  it.each([
    ["Bake at 180 °C for 25 minutes.", "Bake at 350°F for 25 minutes."],
    ["Verwarm de oven voor op 200°.", "Verwarm de oven voor op 400°F."],
    ["Cook to 118°C", "Cook to 245°F"],
    ["Add 250 ml stock", "Add 1 cup stock"],
    ["Add 500 ml stock", "Add 2 cups stock"],
    ["Brown 500 g beef", "Brown 1 lb beef"],
    ["Add 1,5 l water", "Add 6 ½ cups water"],
    ["Bake at 350°F", "Bake at 350°F"],
  ])("to US: %s", (text, expected) => {
    expect(convertStepText(text, "us")).toBe(expected);
  });
});
