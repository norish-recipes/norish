import { describe, expect, it } from "vitest";

import {
  parseIngredientSearch,
  toggleIngredientSearchField,
} from "../../src/lib/ingredient-search";

describe("parseIngredientSearch", () => {
  it("reads a text as contained anywhere, folded, in name and translations by default", () => {
    expect(parseIngredientSearch(" Crème ")).toEqual({
      fold: "creme",
      pattern: "%creme%",
      match: "contains",
      fields: ["name", "translations"],
    });
  });

  it("reads an exact match as the fold itself", () => {
    expect(parseIngredientSearch("Cola", { match: "exact" })).toEqual({
      fold: "cola",
      pattern: "cola",
      match: "exact",
      fields: ["name", "translations"],
    });
  });

  it("no longer reads % or <…> as syntax: they fold away like any punctuation", () => {
    expect(parseIngredientSearch("%cola%")?.pattern).toBe("%cola%");
    expect(parseIngredientSearch("<cola>", { match: "exact" })?.pattern).toBe("cola");
  });

  it("keeps the fields it was asked to look in", () => {
    expect(parseIngredientSearch("ui", { fields: ["parent"] })?.fields).toEqual(["parent"]);
  });

  it("asks nothing of an empty search, or of no field at all", () => {
    expect(parseIngredientSearch("  ")).toBeNull();
    expect(parseIngredientSearch("cola", { fields: [] })).toBeNull();
  });
});

describe("toggleIngredientSearchField", () => {
  it("adds and removes a field, never down to none", () => {
    expect(toggleIngredientSearchField(["name"], "parent")).toEqual(["name", "parent"]);
    expect(toggleIngredientSearchField(["name", "parent"], "parent")).toEqual(["name"]);
    expect(toggleIngredientSearchField(["name"], "name")).toEqual(["name"]);
  });
});
