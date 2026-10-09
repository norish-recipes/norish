import { describe, expect, it } from "vitest";

import { foldFoodName, indexByName, matchByName, normaliseFoodName } from "../src/names";

const food = (name: string, kcal = 40) => ({ name, kcal, fat: 0, carbs: 0, protein: 0 });

describe("matching a taxonomy entry to a dataset food by name", () => {
  it("folds case, accents and punctuation", () => {
    expect(foldFoodName("Crème fraîche, épaisse")).toBe("creme fraiche epaisse");
  });

  it("normalises away brackets, filler and the usual state, and compares words in any order", () => {
    expect(normaliseFoodName("Onions, red, raw")).toBe(normaliseFoodName("red onion"));
    expect(normaliseFoodName("Wine (average)")).toBe(normaliseFoodName("wine"));
    expect(normaliseFoodName("Tomatoes, fresh")).toBe("tomato");
  });

  it("keeps the words that change the food, and every word as often as it occurs", () => {
    expect(normaliseFoodName("whole rice flour")).not.toBe(normaliseFoodName("Rice flour"));
    expect(normaliseFoodName("Paprika, powder")).not.toBe(normaliseFoodName("paprika"));
    expect(normaliseFoodName("tomatoes in tomato juice")).not.toBe(
      normaliseFoodName("Tomato juice")
    );
  });

  it("matches red onion, and not whole rice flour to rice flour", () => {
    const sources = [indexByName([food("Onions, red, raw", 40), food("Rice flour", 366)])];

    expect(matchByName(["red onion"], sources)?.name).toBe("Onions, red, raw");
    expect(matchByName(["whole rice flour"], sources)).toBeNull();
  });

  it("matches exactly before it normalises, across every source", () => {
    const ciqual = indexByName([food("Onion, raw", 35)]);
    const usda = indexByName([food("Onion", 40)]);

    expect(matchByName(["onion"], [ciqual, usda])?.name).toBe("Onion");
  });

  it("takes the first source with candidates, CIQUAL before USDA", () => {
    const ciqual = indexByName([food("Leek, raw", 30)]);
    const usda = indexByName([food("Leeks, raw", 61)]);

    expect(matchByName(["leek"], [ciqual, usda])?.name).toBe("Leek, raw");
  });

  it("takes an ambiguous key only where its candidates' calories agree within 10%", () => {
    const agreeing = indexByName([food("Wine, red", 76), food("Wine (red)", 80)]);
    const disagreeing = indexByName([food("Cheese, average", 300), food("Cheese (average)", 380)]);

    expect(matchByName(["red wine"], [agreeing])?.name).toBe("Wine, red");
    expect(matchByName(["cheese"], [disagreeing])).toBeNull();
  });
});
