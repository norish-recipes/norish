import { describe, expect, it } from "vitest";

import {
  hasSearchText,
  SEARCH_WORDS_MAX,
  searchTerms,
  searchWords,
} from "../../src/lib/search-terms";

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

describe("the word cap", () => {
  const many = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");

  it("keeps the first SEARCH_WORDS_MAX terms and words of a long text", () => {
    expect(SEARCH_WORDS_MAX).toBe(16);
    expect(searchTerms(many)).toEqual(Array.from({ length: 16 }, (_, i) => `w${i}`));
    expect(searchWords(`${many},extra`)).toEqual(Array.from({ length: 16 }, (_, i) => `w${i}`));
  });

  it("caps the words a few comma-joined terms split into", () => {
    const joined = Array.from({ length: 40 }, (_, i) => `w${i}`).join(",");

    expect(searchWords(joined)).toHaveLength(16);
  });

  it("leaves an ordinary search as it was", () => {
    expect(searchTerms("chicken rice soup")).toEqual(["chicken", "rice", "soup"]);
    expect(searchWords("chicken,rice soup")).toEqual(["chicken", "rice", "soup"]);
  });
});

describe("hasSearchText", () => {
  it("is true only for text with a search word", () => {
    expect(hasSearchText("chick")).toBe(true);
    expect(hasSearchText(" crème ")).toBe(true);

    for (const text of [undefined, "", "  ", "-", "^ !", " , "])
      expect(hasSearchText(text)).toBe(false);
  });
});
