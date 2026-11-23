import type { GroceriesSection } from "@/lib/groceries-section";
import { recipeIdOf } from "@/lib/tab-routes";
import { describe, expect, it } from "vitest";

import type { LibraryTypeFilter } from "@norish/shared/contracts";

import { accessoryPlan, accessoryScreen, shellTab, tabPage } from "../utils/accessory-plan";

// The action a plan holds, by its test id.
const holds = (
  path: string,
  hasTimers: boolean,
  recipeId?: string,
  lens: LibraryTypeFilter = "all",
  editableCookbook: string | null = null,
  groceries: GroceriesSection = "list"
) => {
  const plan = accessoryPlan({ path, recipeId }, hasTimers, lens, editableCookbook, groceries);

  return { add: plan.add?.testID, capsule: plan.capsule };
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
  });

  it("reads Add to pantry, into the Pantry's add sheet, while the page shows the Pantry", () => {
    const onPantry = (path: string, hasTimers = false) =>
      holds(path, hasTimers, undefined, "all", null, "pantry");

    expect(onPantry("/groceries")).toEqual({ add: "add-pantry", capsule: false });
    expect(onPantry("/groceries/pantry-add")?.add).toBe("add-pantry");
    expect(onPantry("/groceries/food")?.add).toBe("add-pantry");
    expect(onPantry("/groceries", true)).toEqual({ add: "add-pantry", capsule: true });
    expect(accessoryPlan({ path: "/groceries" }, false, "all", null, "pantry").add).toMatchObject({
      labelId: "groceries.pantry.add",
      route: "/groceries/pantry-add",
    });
  });

  it("reads Add items on the list, and every other tab's own action off the Groceries tab", () => {
    expect(holds("/groceries", false)?.add).toBe("add-grocery");
    expect(holds("/", false, undefined, "all", null, "pantry")?.add).toBe("add-recipe");
    expect(holds("/calendar", false, undefined, "all", null, "pantry")?.add).toBe(
      "plan-recipe-accessory"
    );
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

    expect(library?.testID).not.toBe(cookbook?.testID);
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

describe("accessoryPlan under a root sheet", () => {
  // The action over `sheet` opened on `lastTabPage`, as the shell reads it: a root sheet is off the tabs.
  const over = (
    sheet: string,
    lastTabPage: string,
    groceries: GroceriesSection = "list",
    shownRecipe: string | null = null
  ) => {
    const page = tabPage(sheet, false, lastTabPage);
    const screen = accessoryScreen(page, recipeIdOf(page), "/", shownRecipe);

    return accessoryPlan(screen, true, "all", null, groceries).add?.testID;
  };

  it("keeps the page's own action over the timers and Add recipe", () => {
    for (const sheet of ["/timers", "/add-recipe"]) {
      expect(over(sheet, "/groceries")).toBe("add-grocery");
      expect(over(sheet, "/groceries", "pantry")).toBe("add-pantry");
      expect(over(sheet, "/calendar")).toBe("plan-recipe-accessory");
      expect(over(sheet, "/recipe/abc", "list", "abc")).toBe("cook-recipe");
    }
  });

  it("is the path itself on a tab", () => {
    expect(tabPage("/groceries", true, "/calendar")).toBe("/groceries");
    expect(tabPage("/timers", false, "/calendar")).toBe("/calendar");
  });
});

describe("shellTab", () => {
  it("names the tab a path is on, Recipes for its pages and sheets", () => {
    expect(shellTab("/")).toBe("recipes");
    expect(shellTab("/recipe/r1/cook")).toBe("recipes");
    expect(shellTab("/cookbook/c1")).toBe("recipes");
    expect(shellTab("/groceries/food")).toBe("groceries");
    expect(shellTab("/calendar/item")).toBe("calendar");
  });

  it("names Search for every page in its stack, whose paths carry no tab", () => {
    expect(shellTab("/search", true)).toBe("search");
    expect(shellTab("/recipe/r1", true)).toBe("search");
    expect(shellTab("/filters", true)).toBe("search");
  });
});

describe("the accessory in Search's stack", () => {
  it("adds nothing on its own pages and sheets, with or without a timer", () => {
    for (const path of ["/search", "/filters"]) {
      expect(accessoryPlan({ path, search: true }, false, "all").add).toBeNull();
      expect(accessoryPlan({ path, search: true }, true, "all")).toEqual({
        add: null,
        capsule: true,
      });
    }
  });

  it("holds Cook on a shown recipe, as in the Recipes tab", () => {
    const screen = accessoryScreen("/recipe/r1", "r1", "/search", "r1", true);

    expect(accessoryPlan(screen, true, "all")).toMatchObject({
      add: { testID: "cook-recipe" },
      capsule: true,
    });
  });

  it("does not fall back to Add recipe while the recipe loads", () => {
    const screen = accessoryScreen("/recipe/r1", "r1", "/search", null, true);

    expect(screen).toEqual({ path: "/search", search: true });
    expect(accessoryPlan(screen, false, "all").add).toBeNull();
  });
});
