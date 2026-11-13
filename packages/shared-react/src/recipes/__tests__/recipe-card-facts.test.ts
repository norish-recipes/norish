import { describe, expect, it } from "vitest";

import { allergenSet, recipeCardFacts } from "../recipe-card-facts";

const recipe = (over: object = {}) =>
  ({
    tags: [{ name: "easy" }, { name: " Lactose " }, { name: "EASY" }, { name: "" }],
    totalMinutes: null,
    prepMinutes: 10,
    cookMinutes: 20,
    servings: 4,
    ...over,
  }) as Parameters<typeof recipeCardFacts>[0];

describe("allergenSet", () => {
  it("lower-cases the allergies", () => {
    expect([...allergenSet(["Lactose", "GLUTEN"])]).toEqual(["lactose", "gluten"]);
  });
});

describe("recipeCardFacts", () => {
  it("states the trimmed description, empty when there is none", () => {
    expect(recipeCardFacts(recipe({ description: "  Quick  " }), []).description).toBe("Quick");
    expect(recipeCardFacts(recipe({ description: null }), []).description).toBe("");
  });

  it("lists a reader's allergens first, once each", () => {
    const facts = recipeCardFacts(recipe(), ["lactose"]);

    expect(facts.tagNames).toEqual(["Lactose", "easy"]);
    expect(facts.allergySet.has("lactose")).toBe(true);
  });

  it("sums prep and cook time when there is no total", () => {
    expect(recipeCardFacts(recipe(), []).timeLabel).toBe("30m");
    expect(recipeCardFacts(recipe({ totalMinutes: 75 }), []).timeLabel).toBe("1:15h");
  });

  it("has no time or servings to state when there are none", () => {
    const facts = recipeCardFacts(
      recipe({ prepMinutes: null, cookMinutes: null, servings: 0 }),
      []
    );

    expect(facts.timeLabel).toBeFalsy();
    expect(facts.servings).toBeNull();
  });
});
