import { afterEach, describe, expect, it } from "vitest";

import {
  keepSearchFilters,
  resetSearchSession,
  savedSearchFilters,
  SEARCH_START,
} from "@/lib/search-session";

afterEach(resetSearchSession);

describe("the Search session", () => {
  it("starts on recipes only, ranked by Best match, Title and Ingredients", () => {
    expect(savedSearchFilters()).toMatchObject({
      libraryType: "recipes",
      sortMode: "none",
      searchFields: ["title", "ingredients"],
      rawInput: "",
    });
  });

  it("keeps what it is given until the session ends", () => {
    keepSearchFilters({ ...SEARCH_START, rawInput: "soup" });

    expect(savedSearchFilters().rawInput).toBe("soup");

    resetSearchSession();

    expect(savedSearchFilters().rawInput).toBe("");
  });
});
