/**
 * Where a page came from travels in its own address.
 *
 * "Back to recipes" used to be hardcoded on every recipe page, which was right
 * on the Library and wrong from inside a cookbook — so this is the seam that
 * decides both where the link goes and whether it can be trusted.
 */
import {
  BACK_PARAM,
  cookbookIdFromPath,
  recipeIdFromPath,
  safeOrigin,
  withOrigin,
} from "@/lib/back-destination";
import { describe, expect, it } from "vitest";

describe("safeOrigin", () => {
  it("keeps a path in this app", () => {
    expect(safeOrigin("/cookbooks/abc")).toBe("/cookbooks/abc");
    expect(safeOrigin("/")).toBe("/");
  });

  it("refuses anything that leaves the site", () => {
    // A back link is a way back, never a way out.
    expect(safeOrigin("https://evil.example")).toBeNull();
    expect(safeOrigin("//evil.example")).toBeNull();
    expect(safeOrigin("javascript:alert(1)")).toBeNull();
    expect(safeOrigin(null)).toBeNull();
    expect(safeOrigin("")).toBeNull();
  });
});

describe("withOrigin", () => {
  it("remembers where the reader was standing", () => {
    expect(withOrigin("/recipes/1", "/cookbooks/abc")).toBe(
      `/recipes/1?${BACK_PARAM}=%2Fcookbooks%2Fabc`
    );
  });

  it("says nothing when there is nothing to say", () => {
    expect(withOrigin("/recipes/1", null)).toBe("/recipes/1");
    expect(withOrigin("/recipes/1", "https://evil.example")).toBe("/recipes/1");
    // Opening a recipe from a recipe would offer to go back to where you are.
    expect(withOrigin("/recipes/1", "/recipes/1")).toBe("/recipes/1");
  });
});

describe("reading an origin back", () => {
  it("names the cookbook or the recipe it points at", () => {
    expect(cookbookIdFromPath("/cookbooks/abc")).toBe("abc");
    expect(recipeIdFromPath("/recipes/xyz")).toBe("xyz");
  });

  it("claims nothing about any other path", () => {
    expect(cookbookIdFromPath("/")).toBeNull();
    expect(cookbookIdFromPath("/recipes/abc")).toBeNull();
    expect(cookbookIdFromPath("/cookbooks/abc/extra")).toBeNull();
    expect(recipeIdFromPath("/recipes/abc/edit")).toBeNull();
    expect(recipeIdFromPath(null)).toBeNull();
  });
});
