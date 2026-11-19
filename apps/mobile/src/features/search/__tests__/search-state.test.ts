import { describe, expect, it } from "vitest";

import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import { hasSearchFilters, noResultsVariant, searchView } from "../utils/search-state";

const base = { text: "", confirmed: false, focused: false, resultCount: null };

describe("which state shows", () => {
  it("rests and focuses with no text", () => {
    expect(searchView(base)).toBe("rested");
    expect(searchView({ ...base, focused: true })).toBe("focused");
  });

  it("types until confirmed, then shows results even when the keyboard is down", () => {
    expect(searchView({ ...base, text: "chick", focused: true })).toBe("typing");
    expect(searchView({ ...base, text: "  ", focused: true })).toBe("focused");
    expect(searchView({ ...base, text: "chick", confirmed: true, resultCount: 3 })).toBe("results");
  });

  it("shows results while loading and no results only for a loaded empty list", () => {
    expect(searchView({ ...base, confirmed: true, resultCount: null })).toBe("results");
    expect(searchView({ ...base, confirmed: true, resultCount: 0 })).toBe("none");
  });
});

describe("no-results variant", () => {
  it("offers Clear filters whenever a chip filters", () => {
    expect(noResultsVariant(true, true)).toBe("clear-filters");
    expect(noResultsVariant(true, false)).toBe("clear-filters");
  });

  it("offers Search all fields for a narrowed scope without chips, else nothing", () => {
    expect(noResultsVariant(false, true)).toBe("search-all-fields");
    expect(noResultsVariant(false, false)).toBe("plain");
  });
});

describe("filters", () => {
  it("does not count the text as a chip", () => {
    expect(hasSearchFilters({ ...DEFAULT_RECIPE_FILTERS, rawInput: "soup" })).toBe(false);
    expect(hasSearchFilters({ ...DEFAULT_RECIPE_FILTERS, searchTags: ["soup"] })).toBe(true);
  });
});
