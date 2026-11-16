import { describe, expect, it } from "vitest";

import type { LibraryTypeFilter } from "@norish/shared/contracts";

import { accessoryPlan, accessoryScreen, labelFits } from "../utils/accessory-plan";

// The action a plan holds, by its test id; Add recipe by its name.
const holds = (
  path: string,
  hasTimers: boolean,
  recipeId?: string,
  lens: LibraryTypeFilter = "all"
) => {
  const plan = accessoryPlan({ path, recipeId }, hasTimers, lens);

  return (
    plan && {
      add: plan.add && typeof plan.add === "object" ? plan.add.testID : plan.add,
      capsule: plan.capsule,
    }
  );
};

describe("accessoryPlan", () => {
  it("holds the tab's add action alone while no timer exists", () => {
    expect(holds("/", false)).toEqual({ add: "addRecipe", capsule: false });
    expect(holds("/groceries", false)).toEqual({ add: "add-grocery", capsule: false });
    expect(holds("/calendar", false)).toEqual({ add: "plan-recipe-accessory", capsule: false });
  });

  it("adds the timer capsule on every tab while a timer exists", () => {
    expect(holds("/", true)).toEqual({ add: "addRecipe", capsule: true });
    expect(holds("/groceries/stores", true)).toEqual({ add: "add-grocery", capsule: true });
    expect(holds("/calendar", true)).toEqual({ add: "plan-recipe-accessory", capsule: true });
    expect(holds("/settings", true)).toEqual({ add: "addRecipe", capsule: true });
  });

  it("shows nothing on the Pantry without a timer, and the capsule alone with one", () => {
    expect(holds("/groceries/pantry", false)).toBeNull();
    expect(holds("/groceries/food", false)).toBeNull();
    expect(holds("/groceries/pantry", true)).toEqual({ add: null, capsule: true });
  });

  it("reads Cook, into that recipe's cook mode, on a shown recipe's page and its sheets", () => {
    expect(holds("/recipe/abc", false, "abc")).toEqual({ add: "cook-recipe", capsule: false });
    expect(holds("/recipe/abc/servings", true, "abc")).toEqual({
      add: "cook-recipe",
      capsule: true,
    });
    expect(
      accessoryPlan({ path: "/recipe/abc", recipeId: "abc" }, false, "all")?.add
    ).toMatchObject({
      route: { pathname: "/recipe/[id]/cook", params: { id: "abc" } },
    });
  });
});

describe("accessoryPlan on the Cookbooks lens", () => {
  it("reads Add cookbook, into New cookbook, at the Recipes root, beside a timer too", () => {
    expect(holds("/", false, undefined, "cookbooks")).toEqual({
      add: "add-cookbook",
      capsule: false,
    });
    expect(holds("/", true, undefined, "cookbooks")).toEqual({
      add: "add-cookbook",
      capsule: true,
    });
    expect(accessoryPlan({ path: "/" }, false, "cookbooks")?.add).toMatchObject({
      route: "/new-cookbook",
    });
  });

  it("keeps the other lenses on Add recipe", () => {
    expect(holds("/", false, undefined, "recipes")?.add).toBe("addRecipe");
    expect(holds("/", false, undefined, "all")?.add).toBe("addRecipe");
  });

  it("leaves every other screen to its own action", () => {
    expect(holds("/groceries", false, undefined, "cookbooks")?.add).toBe("add-grocery");
    expect(holds("/calendar", false, undefined, "cookbooks")?.add).toBe("plan-recipe-accessory");
    expect(holds("/cookbook/c1", false, undefined, "cookbooks")?.add).toBe("addRecipe");
    expect(holds("/recipe/abc", false, "abc", "cookbooks")?.add).toBe("cook-recipe");
  });
});

describe("accessoryScreen", () => {
  it("is the recipe's once its page is shown with that recipe", () => {
    expect(accessoryScreen("/recipe/abc", "abc", "/", "abc")).toEqual({
      path: "/recipe/abc",
      recipeId: "abc",
    });
    expect(accessoryScreen("/recipe/abc/share", "abc", "/", "abc")).toEqual({
      path: "/recipe/abc/share",
      recipeId: "abc",
    });
  });

  it("keeps the screen below while the page is sliding in, loading or missing", () => {
    expect(accessoryScreen("/recipe/abc", "abc", "/cookbook/c1", null)).toEqual({
      path: "/cookbook/c1",
    });
    expect(accessoryScreen("/recipe/abc", "abc", "/", "other")).toEqual({ path: "/" });
  });

  it("keeps the Recipes tab's own action under a recipe opened from another tab", () => {
    const screen = accessoryScreen("/recipe/abc", "abc", "/calendar/item", null);

    expect(holds(screen.path, false)?.add).toBe("addRecipe");
    expect(accessoryScreen("/recipe/abc", "abc", "/groceries", null)).toEqual({ path: "/" });
  });

  it("passes every other path through", () => {
    expect(accessoryScreen("/groceries", undefined, "/", "abc")).toEqual({ path: "/groceries" });
  });
});

describe("labelFits", () => {
  it("does not know until the room and the label are measured", () => {
    expect(labelFits(null, 80)).toBeNull();
    expect(labelFits(120, null)).toBeNull();
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
