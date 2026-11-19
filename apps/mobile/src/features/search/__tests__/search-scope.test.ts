import { describe, expect, it } from "vitest";

import { ALL_SCOPE, isScopeNarrowed, toggleScope } from "../utils/search-scope";

describe("the Search Scope", () => {
  it("lets several fields be on, kept in chip order", () => {
    expect(toggleScope(["title", "ingredients"], "steps")).toEqual([
      "title",
      "ingredients",
      "steps",
    ]);
    expect(toggleScope(["title", "steps"], "tags")).toEqual(["title", "tags", "steps"]);
  });

  it("turns a field off", () => {
    expect(toggleScope(["title", "ingredients"], "title")).toEqual(["ingredients"]);
  });

  it("keeps at least one field on", () => {
    expect(toggleScope(["tags"], "tags")).toEqual(["tags"]);
  });

  it("is narrowed unless every field is on", () => {
    expect(isScopeNarrowed(["title", "ingredients"])).toBe(true);
    expect(isScopeNarrowed(ALL_SCOPE)).toBe(false);
  });
});
