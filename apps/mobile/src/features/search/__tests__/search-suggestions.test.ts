import { describe, expect, it } from "vitest";

import type { FieldState } from "../utils/search-field";
import type { NarrowSuggestions } from "../utils/search-suggestions";
import { fieldStep, FRESH_FIELD } from "../utils/search-field";
import { searchView, showsResults } from "../utils/search-state";
import { narrowPatch, narrowRows, suggestionText } from "../utils/search-suggestions";

const suggestions: NarrowSuggestions = {
  ingredients: [
    { id: "chicken", name: "Chicken", localeNames: { nl: "Kip" } },
    { id: "chickpea", name: "Chickpea", localeNames: {} },
  ],
  tags: ["chicken", "Chicken curry"],
  categories: ["Chicken dinner"],
};
const none = { ingredients: [], searchTags: [], categories: [] };
const holding = (text: string, confirmed = false): FieldState => ({
  ...FRESH_FIELD,
  text,
  confirmed,
});

describe("suggestion text", () => {
  it("is the trimmed text, or nothing while it holds no word", () => {
    expect(suggestionText("  chick ")).toBe("chick");

    for (const text of ["", "   ", "^", "!!"]) expect(suggestionText(text)).toBe("");
  });
});

describe("the rows to narrow to", () => {
  it("lists Ingredients, then Tags, then Categories, with an Ingredient in the reader's language", () => {
    expect(narrowRows(suggestions, none, "nl")).toEqual([
      { kind: "ingredient", id: "chicken", name: "Kip" },
      { kind: "ingredient", id: "chickpea", name: "Chickpea" },
      { kind: "tag", name: "chicken" },
      { kind: "tag", name: "Chicken curry" },
      { kind: "category", name: "Chicken dinner" },
    ]);
  });

  it("has none before the suggestions arrive", () => {
    expect(narrowRows(undefined, none, "en")).toEqual([]);
  });

  it("leaves out an entry that is already a chip, whatever its case", () => {
    const rows = narrowRows(
      suggestions,
      { ingredients: ["chicken"], searchTags: ["Chicken"], categories: ["chicken DINNER"] },
      "en"
    );

    expect(rows).toEqual([
      { kind: "ingredient", id: "chickpea", name: "Chickpea" },
      { kind: "tag", name: "Chicken curry" },
    ]);
  });

  it("adds a Tag or Category to the chips already applied", () => {
    expect(narrowPatch({ kind: "tag", name: "quick" }, { ...none, searchTags: ["vegan"] })).toEqual(
      { searchTags: ["vegan", "quick"] }
    );
    expect(
      narrowPatch({ kind: "category", name: "Dinner" }, { ...none, categories: ["Lunch"] })
    ).toEqual({ categories: ["Lunch", "Dinner"] });
  });
});

describe("confirming and narrowing", () => {
  it("confirms from the row as from the search key", () => {
    const typed = holding("chick");
    const fromKey = fieldStep(typed, { type: "submitted", text: "chick" }, 1000);

    expect(fromKey.state).toMatchObject({ text: "chick", confirmed: true });
    expect(fieldStep(typed, { type: "submitted", text: typed.text }, 1000)).toEqual(fromKey);
  });

  it("narrows by emptying the text, leaving Results with one chip and none without", () => {
    const { state, push } = fieldStep(holding("chick"), { type: "narrowed" }, 1000);
    const view = (hasChips: boolean) =>
      searchView({
        text: state.text,
        confirmed: state.confirmed,
        hasChips,
        focused: true,
        resultCount: 3,
      });

    expect(state).toMatchObject({ text: "", confirmed: false });
    expect(push).toBe("");
    expect(view(true)).toBe("results");
    expect(view(false)).toBe("focused");
  });

  it("narrows again from new text: a second chip, still Results", () => {
    const first = fieldStep(holding("chick"), { type: "narrowed" }, 1000).state;
    const typed = fieldStep(first, { type: "typed", text: "tom" }, 2000).state;
    const second = fieldStep(typed, { type: "narrowed" }, 3000).state;
    const input = { text: second.text, confirmed: second.confirmed, hasChips: true };

    expect(searchView({ ...input, focused: true, resultCount: 2 })).toBe("results");
    expect(showsResults({ ...input, focused: true, resultCount: 2 })).toBe(true);
  });

  it("shows the typing state, not Results, for text typed over a chip", () => {
    const state = fieldStep(holding(""), { type: "typed", text: "tom" }, 1000).state;

    expect(searchView({ ...state, hasChips: true, focused: true, resultCount: 3 })).toBe("typing");
  });
});
