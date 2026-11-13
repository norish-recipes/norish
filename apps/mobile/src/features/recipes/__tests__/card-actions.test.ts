import {
  cookbookMenuActions,
  recipeMenuActions,
  recipeSwipeActions,
} from "@/features/recipes/utils/card-actions";
import { describe, expect, it } from "vitest";

describe("recipeSwipeActions", () => {
  it("offers Delete only to a reader who may delete", () => {
    expect(recipeSwipeActions(true)).toEqual(["groceries", "plan", "delete"]);
    expect(recipeSwipeActions(false)).toEqual(["groceries", "plan"]);
  });
});

describe("recipeMenuActions", () => {
  it("lists the board's menu with Delete last", () => {
    expect(recipeMenuActions({ canDelete: true, canRemoveFromCookbook: false })).toEqual([
      "favourite",
      "groceries",
      "plan",
      "addToCookbook",
      "delete",
    ]);
  });

  it("puts Remove from cookbook before Delete inside a cookbook", () => {
    expect(recipeMenuActions({ canDelete: true, canRemoveFromCookbook: true })).toEqual([
      "favourite",
      "groceries",
      "plan",
      "addToCookbook",
      "removeFromCookbook",
      "delete",
    ]);
  });

  it("drops what the reader may not do", () => {
    expect(recipeMenuActions({ canDelete: false, canRemoveFromCookbook: false })).toEqual([
      "favourite",
      "groceries",
      "plan",
      "addToCookbook",
    ]);
  });
});

describe("cookbookMenuActions", () => {
  it("splits editing from deleting", () => {
    expect(cookbookMenuActions({ canEdit: true, canDelete: true })).toEqual([
      "addRecipes",
      "rename",
      "delete",
    ]);
    expect(cookbookMenuActions({ canEdit: true, canDelete: false })).toEqual([
      "addRecipes",
      "rename",
    ]);
    expect(cookbookMenuActions({ canEdit: false, canDelete: true })).toEqual(["delete"]);
    expect(cookbookMenuActions({ canEdit: false, canDelete: false })).toEqual([]);
  });
});
