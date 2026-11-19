import {
  getSearchConfirmed,
  resetSearchSession,
  SEARCH_START,
  searchStore,
  setSearchConfirmed,
} from "@/lib/search-session";
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
    expect(getSearchConfirmed()).toBe(false);
  });

  it("keeps what it is given until the session ends", () => {
    searchStore.getState().setFilters({ rawInput: "soup" });
    setSearchConfirmed(true);

    expect(searchStore.getState().filters.rawInput).toBe("soup");

    resetSearchSession();

    expect(searchStore.getState().filters).toEqual(SEARCH_START);
    expect(getSearchConfirmed()).toBe(false);
  });

  it("drops its Ingredient filters when the session ends", () => {
    searchStore
      .getState()
      .addIngredient({ id: "a0000000-0000-4000-8000-000000000001", name: "onion" });
    resetSearchSession();

    expect(searchStore.getState().filters.ingredients).toEqual([]);
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
