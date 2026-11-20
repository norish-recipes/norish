/** Search's session belongs to one account: a switch, sign-out or expiry starts it over, a wipe keeps it. */
import {
  followSearchOwner,
  getSearchConfirmed,
  resetSearchSession,
  SEARCH_START,
  searchStore,
  setSearchConfirmed,
} from "@/lib/search-session";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const state = {
  owner: null as string | null,
  next: null as string | null,
  listeners: new Set<() => void>(),
};
const ownerData = {
  owner: () => state.owner,
  next: () => state.next,
  read: async () => undefined,
  write: async () => undefined,
  subscribe: (listener: () => void) => {
    state.listeners.add(listener);

    return () => {
      state.listeners.delete(listener);
    };
  },
};

followSearchOwner(ownerData);

/** The cache manager opening an owner's data, or closing it on the way to `next`. */
function tell(owner: string | null, next: string | null = owner) {
  state.owner = owner;
  state.next = next;
  state.listeners.forEach((listener) => listener());
}

function search() {
  searchStore.getState().setFilters({
    rawInput: "soup",
    searchTags: ["Quick"],
    searchFields: ["title"],
    sortMode: "titleAsc",
  });
  setSearchConfirmed(true);
}

const startedOver = () =>
  expect([searchStore.getState().filters, getSearchConfirmed()]).toEqual([SEARCH_START, false]);

describe("Search's session", () => {
  beforeEach(() => {
    tell("u1");
    search();
  });

  it("starts over the moment a direct switch to another account starts", () => {
    tell(null, "u2");

    startedOver();
  });

  it("starts over at sign-out or Session Expiry, which reopen no account", () => {
    tell(null, null);

    startedOver();
  });

  it("is kept through a wipe of the Offline Cache", () => {
    tell(null, "u1");
    tell("u1");

    expect(searchStore.getState().filters.rawInput).toBe("soup");
    expect(getSearchConfirmed()).toBe(true);
  });
});

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
    searchStore.getState().addIngredient("a0000000-0000-4000-8000-000000000001");
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
