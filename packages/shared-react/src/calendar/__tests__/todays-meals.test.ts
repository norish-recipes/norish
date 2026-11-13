import { describe, expect, it } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import {
  buildPlannedItemSubtitle,
  firstSlotFrom,
  getPlannedItemTitle,
  groupTodayItemsBySlot,
  isRecipeItem,
  nextMealSlot,
} from "../todays-meals";

function item(overrides: Partial<PlannedItemFromQuery>): PlannedItemFromQuery {
  return {
    id: "item",
    userId: "user",
    date: "2026-11-13",
    slot: "Dinner",
    sortOrder: 0,
    itemType: "recipe",
    recipeId: "recipe",
    title: null,
    recipeName: "Pasta",
    recipeImage: null,
    servings: null,
    calories: null,
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

const LABELS = { note: "Note", serving: "serving", servings: "servings" };

describe("getPlannedItemTitle", () => {
  it("is the recipe's name, a note's title, or the fallback", () => {
    expect(getPlannedItemTitle(item({}), "Untitled")).toBe("Pasta");
    expect(getPlannedItemTitle(item({ recipeName: null, title: "Leftovers" }), "Untitled")).toBe(
      "Leftovers"
    );
    expect(getPlannedItemTitle(undefined, "Untitled")).toBe("Untitled");
  });
});

describe("buildPlannedItemSubtitle", () => {
  it("says Note for a note, and servings with calories for a recipe", () => {
    expect(buildPlannedItemSubtitle(item({ itemType: "note" }), LABELS)).toBe("Note");
    expect(buildPlannedItemSubtitle(item({ servings: 4, calories: 640 }), LABELS)).toBe(
      "4 servings / 640 kcal"
    );
    expect(buildPlannedItemSubtitle(item({ servings: 1 }), LABELS)).toBe("1 serving");
    expect(buildPlannedItemSubtitle(item({}), LABELS)).toBeNull();
    expect(buildPlannedItemSubtitle(undefined, LABELS)).toBeNull();
  });
});

describe("groupTodayItemsBySlot", () => {
  it("groups by slot, each in sort order, every slot present", () => {
    const grouped = groupTodayItemsBySlot([
      item({ id: "b", slot: "Lunch", sortOrder: 2 }),
      item({ id: "a", slot: "Lunch", sortOrder: 1 }),
    ]);

    expect(grouped.Lunch.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(grouped.Breakfast).toEqual([]);
    expect(grouped.Snack).toEqual([]);
  });
});

describe("nextMealSlot", () => {
  it("is breakfast until ten, lunch until two, and dinner after", () => {
    expect(nextMealSlot(7)).toBe("Breakfast");
    expect(nextMealSlot(10)).toBe("Lunch");
    expect(nextMealSlot(13)).toBe("Lunch");
    expect(nextMealSlot(14)).toBe("Dinner");
    expect(nextMealSlot(23)).toBe("Dinner");
  });
});

describe("firstSlotFrom", () => {
  it("takes the slot itself, or the next one shown after it", () => {
    expect(firstSlotFrom(["Breakfast", "Lunch", "Dinner", "Snack"], "Dinner")).toBe("Dinner");
    expect(firstSlotFrom(["Breakfast", "Snack"], "Lunch")).toBe("Snack");
  });

  it("has nothing when every slot shown is earlier", () => {
    expect(firstSlotFrom(["Breakfast"], "Dinner")).toBeUndefined();
  });
});

describe("isRecipeItem", () => {
  it("is true only for a recipe that still has its recipe", () => {
    expect(isRecipeItem(item({}))).toBe(true);
    expect(isRecipeItem(item({ recipeId: null }))).toBe(false);
    expect(isRecipeItem(item({ itemType: "note", recipeId: null, title: "Leftovers" }))).toBe(false);
  });
});
