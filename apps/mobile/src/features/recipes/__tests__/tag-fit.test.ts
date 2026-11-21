import { fitTags } from "@/features/recipes/utils/tag-fit";
import { describe, expect, it } from "vitest";

describe("fitTags", () => {
  it("shows every tag that fits on the line, with no +N", () => {
    expect(fitTags([40, 50, 30], 130, 4, 24)).toEqual({ shown: 3, more: false });
    expect(fitTags([], 100, 4, 24)).toEqual({ shown: 0, more: false });
  });

  it("leaves room for the +N chip after the last tag shown", () => {
    // 40 + 4 + 50 = 94 fits, but with the 24 pt +N after it the line is 122 pt.
    expect(fitTags([40, 50, 30], 121, 4, 24)).toEqual({ shown: 1, more: true });
    expect(fitTags([40, 50, 30], 122, 4, 24)).toEqual({ shown: 2, more: true });
  });

  it("is exact at the edge: a line as wide as the room fits", () => {
    expect(fitTags([40, 50], 94, 4, 24)).toEqual({ shown: 2, more: false });
    expect(fitTags([40, 50], 93, 4, 24)).toEqual({ shown: 1, more: true });
  });

  it("cuts the first tag short beside +N when not even it fits, so a card always names one", () => {
    expect(fitTags([100, 30], 90, 4, 24)).toEqual({ shown: 1, more: true, firstWidth: 62 });
  });

  it("cuts a lone tag to the room, with no +N", () => {
    expect(fitTags([100], 90, 4, 24)).toEqual({ shown: 1, more: false, firstWidth: 90 });
  });

  it("drops +N when it leaves the first tag narrower than itself", () => {
    // 50 pt of room: beside a 24 pt +N the first tag would get 22 pt.
    expect(fitTags([100, 30], 50, 4, 24)).toEqual({ shown: 1, more: false, firstWidth: 50 });
    expect(fitTags([100, 30], 52, 4, 24)).toEqual({ shown: 1, more: true, firstWidth: 24 });
  });
});
