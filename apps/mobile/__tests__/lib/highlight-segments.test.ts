import { highlightSegments } from "@/lib/highlight-segments";
import { describe, expect, it, vi } from "vitest";

/** Runs `fn` with indexOf capped, so a scan that stops advancing fails instead of hanging. */
function bounded<T>(fn: () => T): T {
  const indexOf = String.prototype.indexOf;
  let calls = 0;
  const spy = vi.spyOn(String.prototype, "indexOf").mockImplementation(function (
    this: string,
    search: string,
    position?: number
  ) {
    if (++calls > 10_000) throw new Error("the highlighter stopped advancing");

    return indexOf.call(this, search, position);
  });

  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

describe("highlightSegments", () => {
  it("ends on terms that fold to nothing", { timeout: 1000 }, () => {
    expect(bounded(() => highlightSegments("Basil pesto", "basil ^"))).toEqual([
      { text: "Basil", highlighted: true },
      { text: " pesto", highlighted: false },
    ]);
    expect(bounded(() => highlightSegments("Basil pesto", "^ ` \u00b4"))).toEqual([
      { text: "Basil pesto", highlighted: false },
    ]);
    expect(bounded(() => highlightSegments("Basil pesto", ""))).toEqual([
      { text: "Basil pesto", highlighted: false },
    ]);
  });

  it("marks the words the server's any-word fallback found", () => {
    expect(highlightSegments("Chicken", "chicken,rice")).toEqual([
      { text: "Chicken", highlighted: true },
    ]);
    expect(highlightSegments("Fried rice", "chicken,rice")).toEqual([
      { text: "Fried ", highlighted: false },
      { text: "rice", highlighted: true },
    ]);
  });

  it("marks the term wherever it starts a word, ignoring case", () => {
    expect(highlightSegments("Hoisin Chicken and chicken stock", "chicken")).toEqual([
      { text: "Hoisin ", highlighted: false },
      { text: "Chicken", highlighted: true },
      { text: " and ", highlighted: false },
      { text: "chicken", highlighted: true },
      { text: " stock", highlighted: false },
    ]);
  });

  it("matches a prefix, not the middle of a word", () => {
    expect(highlightSegments("Chickpea curry", "chick")).toEqual([
      { text: "Chick", highlighted: true },
      { text: "pea curry", highlighted: false },
    ]);
    expect(highlightSegments("Hen", "en")).toEqual([{ text: "Hen", highlighted: false }]);
  });

  it("ignores accents in both and keeps the text as written", () => {
    expect(highlightSegments("Crème brûlée", "creme brulee")).toEqual([
      { text: "Crème", highlighted: true },
      { text: " ", highlighted: false },
      { text: "brûlée", highlighted: true },
    ]);
    expect(highlightSegments("creme", "Crème")).toEqual([{ text: "creme", highlighted: true }]);
  });

  it("merges overlapping terms", () => {
    expect(highlightSegments("chicken", "chick chicken")).toEqual([
      { text: "chicken", highlighted: true },
    ]);
  });

  it("leaves the text whole when no term is found literally", () => {
    expect(highlightSegments("Roasted potato", "potatoes")).toEqual([
      { text: "Roasted potato", highlighted: false },
    ]);
  });

  it("drops tsquery characters from terms", () => {
    expect(highlightSegments("Soup", "(soup:*)")).toEqual([{ text: "Soup", highlighted: true }]);
  });
});
