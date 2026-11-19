import { describe, expect, it } from "vitest";

import { searchTerms, searchWords } from "../../src/lib/search-terms";

describe("searchTerms", () => {
  it("splits on whitespace and drops tsquery characters", () => {
    expect(searchTerms("  chicken  (rice) | 'soup'! ")).toEqual(["chicken", "rice", "soup"]);
  });

  it("keeps commas, hyphens and dots, which the query parser reads itself", () => {
    expect(searchTerms("chicken,rice stir-fry 1.5")).toEqual(["chicken,rice", "stir-fry", "1.5"]);
  });

  it("keeps a term the query parser drops itself, as before", () => {
    expect(searchTerms("basil ^")).toEqual(["basil", "^"]);
  });

  it("is empty when nothing searchable is left", () => {
    expect(searchTerms(" &| () ")).toEqual([]);
  });
});

describe("searchWords", () => {
  it("splits each term into the words the any-word fallback looks for", () => {
    expect(searchWords("chicken,rice stir-fry ^ crème")).toEqual([
      "chicken",
      "rice",
      "stir",
      "fry",
      "crème",
    ]);
  });
});
