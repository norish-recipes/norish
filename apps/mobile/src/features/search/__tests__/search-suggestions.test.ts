import { describe, expect, it } from "vitest";

import type { LibrarySuggestionsDTO } from "@norish/shared/contracts";
import { MAX_FILTER_INGREDIENTS } from "@norish/shared/contracts/zod";

import type { FieldState } from "../utils/search-field";
import { fieldStep, FRESH_FIELD } from "../utils/search-field";
import { searchView, showsResults } from "../utils/search-state";
import {
  matchingCategories,
  narrowPatch,
  narrowRows,
  suggestionText,
} from "../utils/search-suggestions";

const suggestions: LibrarySuggestionsDTO = {
  ingredients: [
    { id: "chicken", name: "Chicken", localeNames: { nl: "Kip" } },
    { id: "chickpea", name: "Chickpea", localeNames: {} },
  ],
  tags: ["chicken", "Chicken curry"],
  categories: ["Dinner", "Chicken dinner", "Dessert"],
};
// The Filters sheet's labels: a built-in by the reader's language, a custom name as written.
const dutch: Record<string, string> = { Dinner: "Diner", Dessert: "Nagerecht" };
const label = (name: string) => dutch[name] ?? name;
const rows = (
  applied: Parameters<typeof narrowRows>[1],
  over: Partial<Parameters<typeof narrowRows>[0]> = {}
) =>
  narrowRows(
    { suggestions, locale: "en", text: "chick", categoryLabel: (n) => n, ...over },
    applied
  );
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
    expect(rows(none, { locale: "nl" })).toEqual([
      { kind: "ingredient", id: "chicken", name: "Kip" },
      { kind: "ingredient", id: "chickpea", name: "Chickpea" },
      { kind: "tag", name: "chicken" },
      { kind: "tag", name: "Chicken curry" },
      { kind: "category", name: "Chicken dinner", label: "Chicken dinner" },
    ]);
  });

  it("has none before the suggestions arrive", () => {
    expect(rows(none, { suggestions: undefined })).toEqual([]);
  });

  it("leaves out an entry that is already a chip, whatever its case", () => {
    const left = rows({
      ingredients: ["chicken"],
      searchTags: ["Chicken"],
      categories: ["chicken DINNER"],
    });

    expect(left).toEqual([
      { kind: "ingredient", id: "chickpea", name: "Chickpea" },
      { kind: "tag", name: "Chicken curry" },
    ]);
  });

  it("offers no Ingredient at the limit of Ingredient chips, and still Tags and Categories", () => {
    const full = Array.from({ length: MAX_FILTER_INGREDIENTS }, (_, i) => `food-${i}`);

    expect(rows({ ...none, ingredients: full }).map((row) => row.kind)).toEqual([
      "tag",
      "tag",
      "category",
    ]);
    expect(rows({ ...none, ingredients: full.slice(1) }).map((row) => row.kind)[0]).toBe(
      "ingredient"
    );
  });

  it("matches a Category by the label the reader sees and shows that label", () => {
    const left = rows(none, { text: "dine", categoryLabel: label });

    expect(left.filter((row) => row.kind === "category")).toEqual([
      { kind: "category", name: "Dinner", label: "Diner" },
    ]);
    // "Dinner" is "Diner" in Dutch, so the English text finds only the custom Category.
    const english = rows(none, { text: "dinner", categoryLabel: label });

    expect(english.filter((row) => row.kind === "category").map((row) => row.name)).toEqual([
      "Chicken dinner",
    ]);
  });

  it("adds a Tag or Category to the chips already applied", () => {
    expect(narrowPatch({ kind: "tag", name: "quick" }, { ...none, searchTags: ["vegan"] })).toEqual(
      { searchTags: ["vegan", "quick"] }
    );
    expect(
      narrowPatch(
        { kind: "category", name: "Dinner", label: "Dinner" },
        { ...none, categories: ["Lunch"] }
      )
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
        offline: false,
        held: false,
        failed: false,
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
    const input = {
      text: second.text,
      confirmed: second.confirmed,
      hasChips: true,
      offline: false,
      held: false,
      failed: false,
    };

    expect(searchView({ ...input, focused: true, resultCount: 2 })).toBe("results");
    expect(showsResults(input)).toBe(true);
  });

  it("shows the typing state, not Results, for text typed over a chip", () => {
    const state = fieldStep(holding(""), { type: "typed", text: "tom" }, 1000).state;

    expect(
      searchView({
        ...state,
        hasChips: true,
        focused: true,
        resultCount: 3,
        offline: false,
        held: false,
        failed: false,
      })
    ).toBe("typing");
  });
});

describe("matching Categories by their shown label", () => {
  const names = ["Dinner", "Dessert", "Drinks", "Dips", "Main dish"];

  it("matches the start of a word of the label, folded, in the reader's language", () => {
    expect(matchingCategories(names, "NAGE", label)).toEqual(["Dessert"]);
    expect(matchingCategories(names, "diner", label)).toEqual(["Dinner"]);
    // The stored English name no longer matches once the label is Dutch.
    expect(matchingCategories(names, "dinn", label)).toEqual([]);
    expect(matchingCategories(names, "dish", label)).toEqual(["Main dish"]);
    expect(matchingCategories(names, "ish", label)).toEqual([]);
  });

  it("folds accents of a label and caps at three", () => {
    expect(matchingCategories(["Dinner"], "crem", () => "Crème")).toEqual(["Dinner"]);
    expect(matchingCategories(names, "d", (name) => name)).toHaveLength(3);
  });

  it("matches nothing for text with no word", () => {
    expect(matchingCategories(names, "  ", label)).toEqual([]);
  });

  it("takes out an applied Category before the cap, so a fourth match fills its row", () => {
    const four = { ...suggestions, categories: ["Dinner", "Dessert", "Drinks", "Dips"] };
    const shown = (applied: string[]) =>
      rows(
        { ...none, categories: applied },
        { suggestions: four, text: "d", categoryLabel: (n) => n }
      ).flatMap((row) => (row.kind === "category" ? [row.name] : []));

    expect(shown([])).toEqual(["Dinner", "Dessert", "Drinks"]);
    expect(shown(["dessert"])).toEqual(["Dinner", "Drinks", "Dips"]);
  });
});
