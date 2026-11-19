import { resetSearchSession, SEARCH_START, searchStore } from "@/lib/search-session";
import { afterEach, describe, expect, it } from "vitest";

afterEach(resetSearchSession);

describe("the Search session", () => {
  it("starts on recipes only, ranked by Best match, Title and Ingredients", () => {
    expect(searchStore.getState().filters).toMatchObject({
      libraryType: "recipes",
      sortMode: "none",
      searchFields: ["title", "ingredients"],
      rawInput: "",
    });
    expect(searchStore.getState().searchConfirmed).toBe(false);
  });

  it("keeps what it is given until the session ends", () => {
    searchStore.getState().setFilters({ rawInput: "soup" });
    searchStore.getState().setSearchConfirmed(true);

    expect(searchStore.getState().filters.rawInput).toBe("soup");

    resetSearchSession();

    expect(searchStore.getState().filters).toEqual(SEARCH_START);
    expect(searchStore.getState().searchConfirmed).toBe(false);
  });

  it("leaves the text, scope and sort when Clear filters clears the chips", () => {
    searchStore
      .getState()
      .setFilters({ rawInput: "soup", searchTags: ["vegan"], sortMode: "titleAsc" });
    searchStore.getState().clearFilters();

    expect(searchStore.getState().filters).toMatchObject({
      rawInput: "soup",
      searchTags: [],
      sortMode: "titleAsc",
      libraryType: "recipes",
    });
  });
});
