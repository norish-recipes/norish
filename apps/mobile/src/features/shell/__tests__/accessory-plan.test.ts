import { describe, expect, it } from "vitest";

import type { LibraryTypeFilter } from "@norish/shared/contracts";

import { accessoryPlan, accessoryScreen, shellTab } from "../utils/accessory-plan";

// The action a plan holds, by its test id.
const holds = (
  path: string,
  hasTimers: boolean,
  recipeId?: string,
  lens: LibraryTypeFilter = "all",
  editableCookbook: string | null = null
) => {
  const plan = accessoryPlan({ path, recipeId }, hasTimers, lens, editableCookbook);

  return { add: plan.add.testID, capsule: plan.capsule };
};

describe("accessoryPlan", () => {
  it("holds the tab's add action alone while no timer exists", () => {
    expect(holds("/", false)).toEqual({ add: "add-recipe", capsule: false });
    expect(holds("/groceries", false)).toEqual({ add: "add-grocery", capsule: false });
    expect(holds("/calendar", false)).toEqual({ add: "plan-recipe-accessory", capsule: false });
  });

  it("adds the timer capsule on every tab while a timer exists", () => {
    expect(holds("/", true)).toEqual({ add: "add-recipe", capsule: true });
    expect(holds("/groceries/stores", true)).toEqual({ add: "add-grocery", capsule: true });
    expect(holds("/calendar", true)).toEqual({ add: "plan-recipe-accessory", capsule: true });
    expect(holds("/settings", true)).toEqual({ add: "add-recipe", capsule: true });
  });

  it("reads Add to pantry, into the Pantry's add sheet, on the Pantry and its sheets", () => {
    expect(holds("/groceries/pantry", false)).toEqual({ add: "add-pantry", capsule: false });
    expect(holds("/groceries/pantry-add", false)?.add).toBe("add-pantry");
    expect(holds("/groceries/food", false)?.add).toBe("add-pantry");
    expect(holds("/groceries/pantry", true)).toEqual({ add: "add-pantry", capsule: true });
    expect(accessoryPlan({ path: "/groceries/pantry" }, false, "all").add).toMatchObject({
      labelId: "groceries.pantry.add",
      route: "/groceries/pantry-add",
    });
  });

  it("reads Cook, into that recipe's cook mode, on a shown recipe's page and its sheets", () => {
    expect(holds("/recipe/abc", false, "abc")).toEqual({ add: "cook-recipe", capsule: false });
    expect(holds("/recipe/abc/servings", true, "abc")).toEqual({
      add: "cook-recipe",
      capsule: true,
    });
    expect(accessoryPlan({ path: "/recipe/abc", recipeId: "abc" }, false, "all").add).toMatchObject(
      {
        route: { pathname: "/recipe/[id]/cook", params: { id: "abc" } },
      }
    );
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
    expect(accessoryPlan({ path: "/" }, false, "cookbooks").add).toMatchObject({
      route: "/new-cookbook",
    });
  });

  it("keeps the other lenses on Add recipe", () => {
    expect(holds("/", false, undefined, "recipes")?.add).toBe("add-recipe");
    expect(holds("/", false, undefined, "all")?.add).toBe("add-recipe");
  });

  it("leaves every other screen to its own action", () => {
    expect(holds("/groceries", false, undefined, "cookbooks")?.add).toBe("add-grocery");
    expect(holds("/calendar", false, undefined, "cookbooks")?.add).toBe("plan-recipe-accessory");
    expect(holds("/cookbook/c1", false, undefined, "cookbooks")?.add).toBe("add-recipe");
    expect(holds("/recipe/abc", false, "abc", "cookbooks")?.add).toBe("cook-recipe");
  });
});

describe("accessoryPlan on a cookbook", () => {
  it("reads Add recipes, into the cookbook's picker, on a cookbook the Reader may edit", () => {
    expect(holds("/cookbook/c1", false, undefined, "all", "c1")).toEqual({
      add: "cookbook-add-recipes-accessory",
      capsule: false,
    });
    expect(accessoryPlan({ path: "/cookbook/c1" }, false, "all", "c1").add).toMatchObject({
      labelId: "recipes.cookbooks.addRecipes",
      route: { pathname: "/cookbook-add-recipes", params: { cookbookId: "c1" } },
    });
  });

  it("reads Add recipe on a cookbook the Reader may not edit, and off its page", () => {
    expect(holds("/cookbook/c1", false)?.add).toBe("add-recipe");
    expect(holds("/cookbook/c2", false, undefined, "all", "c1")?.add).toBe("add-recipe");
    expect(holds("/", false, undefined, "all", "c1")?.add).toBe("add-recipe");
  });

  it("keys the cookbook's action apart from Add recipe, so the switch cross-fades", () => {
    const library = accessoryPlan({ path: "/" }, false, "all").add;
    const cookbook = accessoryPlan({ path: "/cookbook/c1" }, false, "all", "c1").add;

    expect(library.testID).not.toBe(cookbook.testID);
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

    expect(holds(screen.path, false)?.add).toBe("add-recipe");
    expect(accessoryScreen("/recipe/abc", "abc", "/groceries", null)).toEqual({ path: "/" });
  });

  it("passes every other path through", () => {
    expect(accessoryScreen("/groceries", undefined, "/", "abc")).toEqual({ path: "/groceries" });
  });
});

describe("shellTab", () => {
  it("names the tab a path is on, Recipes for its pages and sheets", () => {
    expect(shellTab("/")).toBe("recipes");
    expect(shellTab("/recipe/r1/cook")).toBe("recipes");
    expect(shellTab("/cookbook/c1")).toBe("recipes");
    expect(shellTab("/groceries/pantry")).toBe("groceries");
    expect(shellTab("/calendar/item")).toBe("calendar");
    expect(shellTab("/settings")).toBe("settings");
    expect(shellTab("/search")).toBe("search");
  });
});
