import { describe, expect, it } from "vitest";

import { accessoryPlan, labelFits, recipePageId, shownPath } from "../utils/accessory-plan";

describe("accessoryPlan", () => {
  it("holds the tab's add action alone while no timer exists", () => {
    expect(accessoryPlan("/", false)).toEqual({ add: "recipes", capsule: false });
    expect(accessoryPlan("/groceries", false)).toEqual({ add: "groceries", capsule: false });
    expect(accessoryPlan("/calendar", false)).toEqual({ add: "calendar", capsule: false });
  });

  it("adds the timer capsule on every tab while a timer exists", () => {
    expect(accessoryPlan("/", true)).toEqual({ add: "recipes", capsule: true });
    expect(accessoryPlan("/groceries/stores", true)).toEqual({ add: "groceries", capsule: true });
    expect(accessoryPlan("/calendar", true)).toEqual({ add: "calendar", capsule: true });
    expect(accessoryPlan("/settings", true)).toEqual({ add: "recipes", capsule: true });
  });

  it("shows nothing on the Pantry without a timer, and the capsule alone with one", () => {
    expect(accessoryPlan("/groceries/pantry", false)).toBeNull();
    expect(accessoryPlan("/groceries/food", false)).toBeNull();
    expect(accessoryPlan("/groceries/pantry", true)).toEqual({ add: null, capsule: true });
  });

  it("reads Cook on a recipe's page and its sheets", () => {
    expect(accessoryPlan("/recipe/abc", false)).toEqual({ add: "cook", capsule: false });
    expect(accessoryPlan("/recipe/abc/servings", true)).toEqual({ add: "cook", capsule: true });
  });
});

describe("shownPath", () => {
  it("labels a recipe once its page is shown with that recipe", () => {
    expect(shownPath("/recipe/abc", "/", "abc")).toBe("/recipe/abc");
    expect(shownPath("/recipe/abc/share", "/", "abc")).toBe("/recipe/abc/share");
  });

  it("keeps the screen below while the page is sliding in, loading or missing", () => {
    expect(shownPath("/recipe/abc", "/cookbook/c1", null)).toBe("/cookbook/c1");
    expect(shownPath("/recipe/abc", "/", "other")).toBe("/");
  });

  it("passes every other path through", () => {
    expect(shownPath("/groceries", "/", "abc")).toBe("/groceries");
  });
});

describe("recipePageId", () => {
  it("names the recipe a path belongs to", () => {
    expect(recipePageId("/recipe/abc")).toBe("abc");
    expect(recipePageId("/recipe/abc/cook")).toBe("abc");
    expect(recipePageId("/recipes")).toBeUndefined();
    expect(recipePageId("/")).toBeUndefined();
  });
});

describe("labelFits", () => {
  it("shows the label until the room and the label are measured", () => {
    expect(labelFits(null, 80)).toBe(true);
    expect(labelFits(120, null)).toBe(true);
  });

  it("keeps the label when sides, icon, gap and label fit the room", () => {
    // 6 + 22 + 8 + 80 + 6 = 122
    expect(labelFits(122, 80)).toBe(true);
    expect(labelFits(121, 80)).toBe(false);
  });

  it("drops a long translation where a short label fits", () => {
    expect(labelFits(150, 40)).toBe(true);
    expect(labelFits(150, 120)).toBe(false);
  });
});
