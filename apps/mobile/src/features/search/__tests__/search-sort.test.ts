import { describe, expect, it } from "vitest";

import { shownSort, sortOptions } from "../utils/search-sort";

describe("the sort chip", () => {
  it("offers Best match first while there is text", () => {
    expect(sortOptions(true)).toEqual(["none", "dateDesc", "dateAsc", "titleAsc", "titleDesc"]);
  });

  it("offers only the explicit sorts without text", () => {
    expect(sortOptions(false)).toEqual(["dateDesc", "dateAsc", "titleAsc", "titleDesc"]);
  });

  it("names Best match as Newest when there is no text to match", () => {
    expect(shownSort("none", true)).toBe("none");
    expect(shownSort("none", false)).toBe("dateDesc");
    expect(shownSort("titleAsc", false)).toBe("titleAsc");
  });
});
