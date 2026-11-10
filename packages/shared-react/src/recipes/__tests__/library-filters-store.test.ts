import { describe, expect, it } from "vitest";

import { createLibraryFiltersStore } from "@norish/shared-react/recipes";
import {
  DEFAULT_PERSISTED_RECIPE_FILTERS,
  DEFAULT_RECIPE_FILTERS,
} from "@norish/shared/contracts/filter-contract";

const TITLE_SORTED = { ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "titleAsc" as const };

describe("createLibraryFiltersStore", () => {
  it("starts on the cookie's filters, applied", () => {
    const { filters, hydrated } = createLibraryFiltersStore(TITLE_SORTED).getState();

    expect(filters).toEqual({ ...TITLE_SORTED, rawInput: "" });
    expect(hydrated).toBe(true);
  });

  it("starts on the defaults without a cookie, waiting for the stored filters", () => {
    const { filters, hydrated } = createLibraryFiltersStore(undefined).getState();

    expect(filters).toEqual(DEFAULT_RECIPE_FILTERS);
    expect(hydrated).toBe(false);
  });

  it("holds what its actions set", () => {
    const store = createLibraryFiltersStore(undefined);

    store.getState().setFilters({ rawInput: "soup", libraryType: "cookbooks" });
    store.getState().toggleSearchField("tags");

    expect(store.getState().filters).toMatchObject({
      rawInput: "soup",
      libraryType: "cookbooks",
      searchFields: [...DEFAULT_RECIPE_FILTERS.searchFields, "tags"],
    });
  });

  it("clears every filter but the Library's type", () => {
    const store = createLibraryFiltersStore({ ...TITLE_SORTED, libraryType: "recipes" });

    store.getState().setFilters({ rawInput: "soup", searchTags: ["Quick"] });
    store.getState().clearFilters();

    expect(store.getState().filters).toEqual({ ...DEFAULT_RECIPE_FILTERS, libraryType: "recipes" });
  });

  it("takes the stored filters over a kept document's", () => {
    const store = createLibraryFiltersStore({
      ...DEFAULT_PERSISTED_RECIPE_FILTERS,
      sortMode: "dateAsc",
    });

    store.getState().applyStored(TITLE_SORTED);

    expect(store.getState().filters.sortMode).toBe("titleAsc");
  });

  it("is applied once storage is read, even with nothing stored", () => {
    const store = createLibraryFiltersStore(undefined);

    store.getState().applyStored(null);

    expect(store.getState()).toMatchObject({ filters: DEFAULT_RECIPE_FILTERS, hydrated: true });
  });

  it("keeps its filters object when storage holds the same filters", () => {
    const store = createLibraryFiltersStore(TITLE_SORTED);
    const before = store.getState().filters;

    store.getState().applyStored(TITLE_SORTED);

    expect(store.getState().filters).toBe(before);
  });
});
