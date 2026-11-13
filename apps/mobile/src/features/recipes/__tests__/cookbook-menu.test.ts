import { cookbookPageActions } from "@/features/recipes/utils/cookbook-menu";
import { describe, expect, it } from "vitest";

describe("cookbookPageActions", () => {
  it("lists the board's menu with Delete cookbook last", () => {
    expect(cookbookPageActions({ canEdit: true, canDelete: true })).toEqual([
      "addRecipes",
      "rename",
      "changeCover",
      "delete",
    ]);
  });

  it("offers filing, renaming and the cover only to a reader who may edit", () => {
    expect(cookbookPageActions({ canEdit: false, canDelete: true })).toEqual(["delete"]);
  });

  it("offers Delete only to a reader who may delete", () => {
    expect(cookbookPageActions({ canEdit: true, canDelete: false })).toEqual([
      "addRecipes",
      "rename",
      "changeCover",
    ]);
  });

  it("has no menu for a reader who may do neither", () => {
    expect(cookbookPageActions({ canEdit: false, canDelete: false })).toEqual([]);
  });
});
