import { describe, expect, it } from "vitest";

import { tagLine } from "../utils/tag-line";

describe("tagLine", () => {
  it("lists Categories, then the tags", () => {
    expect(tagLine(["Dinner"], ["quick", "easy"])).toBe("Dinner, quick, easy");
  });

  it("names a Category once when a tag is the same word in any case", () => {
    expect(tagLine(["Lunch", "Dinner"], ["dinner", "Lunch", "rice"])).toBe("Lunch, Dinner, rice");
  });

  it("is empty with neither", () => {
    expect(tagLine([], [])).toBe("");
  });
});
