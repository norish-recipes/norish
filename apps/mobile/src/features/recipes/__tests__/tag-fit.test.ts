import { fitTags } from "@/features/recipes/utils/tag-fit";
import { describe, expect, it } from "vitest";

describe("fitTags", () => {
  it("shows every tag that fits on the line, with no +N", () => {
    expect(fitTags([40, 50, 30], 130, 4, 24)).toBe(3);
    expect(fitTags([], 100, 4, 24)).toBe(0);
  });

  it("leaves room for the +N chip after the last tag shown", () => {
    // 40 + 4 + 50 = 94 fits, but with the 24 pt +N after it the line is 122 pt.
    expect(fitTags([40, 50, 30], 121, 4, 24)).toBe(1);
    expect(fitTags([40, 50, 30], 122, 4, 24)).toBe(2);
  });

  it("shows only +N when not even the first tag fits beside it", () => {
    expect(fitTags([100, 30], 90, 4, 24)).toBe(0);
  });

  it("is exact at the edge: a line as wide as the room fits", () => {
    expect(fitTags([40, 50], 94, 4, 24)).toBe(2);
    expect(fitTags([40, 50], 93, 4, 24)).toBe(1);
  });
});
