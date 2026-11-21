import { describe, expect, it } from "vitest";

import { noResultsVariant, searchView, showsResults } from "../utils/search-state";

const base = {
  text: "",
  confirmed: false,
  hasChips: false,
  focused: false,
  resultCount: null,
  offline: false,
  held: false,
  failed: false,
};

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
    expect(searchView({ ...base, text: "soup", confirmed: true, resultCount: null })).toBe(
      "results"
    );
    expect(searchView({ ...base, text: "soup", confirmed: true, resultCount: 0 })).toBe("none");
  });
});

describe("text with no search words", () => {
  it("is no text: no typing state, no confirmed search, results only for a chip", () => {
    for (const text of ["-", "^ !", " , "]) {
      expect(searchView({ ...base, text, focused: true })).toBe("focused");
      expect(searchView({ ...base, text, confirmed: true, resultCount: 3 })).toBe("rested");
      expect(showsResults({ text, confirmed: true, hasChips: false })).toBe(false);
      expect(showsResults({ text, confirmed: false, hasChips: true })).toBe(true);
    }
  });
});

describe("a failed search", () => {
  const confirmed = { ...base, text: "soup", confirmed: true, resultCount: 0 };

  it("is never no results while nothing is held: Live it failed, Offline it needs a connection", () => {
    expect(searchView({ ...confirmed, failed: true })).toBe("failed");
    expect(searchView({ ...confirmed, failed: true, offline: true })).toBe("offline");
  });

  it("keeps held results when a refetch fails", () => {
    expect(searchView({ ...confirmed, resultCount: 2, held: true, failed: true })).toBe("results");
    expect(searchView({ ...confirmed, held: true, failed: true })).toBe("none");
  });
});

describe("when Results show", () => {
  it("shows them for a confirmed text, however many chips", () => {
    expect(showsResults({ ...base, text: "soup", confirmed: true })).toBe(true);
    expect(showsResults({ ...base, text: "soup", confirmed: true, hasChips: true })).toBe(true);
  });

  it("shows them for chips alone, and rests with neither", () => {
    expect(showsResults({ ...base, hasChips: true })).toBe(true);
    expect(searchView({ ...base, hasChips: true, resultCount: 2 })).toBe("results");
    expect(searchView({ ...base, confirmed: true })).toBe("rested");
    expect(searchView({ ...base, confirmed: true, focused: true })).toBe("focused");
  });

  it("keeps a typed text a question until confirmed, chips or not", () => {
    expect(searchView({ ...base, text: "so", hasChips: true, focused: true })).toBe("typing");
  });

  it("is no results for a loaded empty list", () => {
    expect(searchView({ ...base, hasChips: true, resultCount: 0 })).toBe("none");
  });
});

describe("Offline", () => {
  const off = { ...base, offline: true };

  it("rests, focuses and types as Live does", () => {
    expect(searchView(off)).toBe("rested");
    expect(searchView({ ...off, focused: true })).toBe("focused");
    expect(searchView({ ...off, text: "soup", focused: true })).toBe("typing");
  });

  it("says search needs a connection for a confirmed text or chips with nothing held", () => {
    expect(searchView({ ...off, text: "soup", confirmed: true })).toBe("offline");
    expect(searchView({ ...off, hasChips: true })).toBe("offline");
    expect(searchView({ ...off, hasChips: true, resultCount: 0 })).toBe("offline");
  });

  it("keeps results held for exactly this search, and never reads none from an unheld one", () => {
    const held = { ...off, text: "soup", confirmed: true, held: true };

    expect(searchView({ ...held, resultCount: 4 })).toBe("results");
    expect(searchView({ ...held, resultCount: 0 })).toBe("none");
    expect(searchView({ ...held, held: false, resultCount: 0 })).toBe("offline");
  });

  it("is unchanged Live whether or not results are held", () => {
    expect(searchView({ ...base, hasChips: true, held: true, resultCount: 2 })).toBe("results");
    expect(searchView({ ...base, hasChips: true, resultCount: null })).toBe("results");
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
