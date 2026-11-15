import { describe, expect, it } from "vitest";

import { HIDDEN_ITEMS, hiddenItemVisibility, partitionHiddenItems } from "../hidden-items";

describe("partitionHiddenItems", () => {
  it("splits a stored list into what a control can offer and what it must carry", () => {
    // Selected names come back in contract order, whatever order they were stored.
    expect(partitionHiddenItems(["something-newer", "rating", "notes"])).toEqual({
      selected: ["notes", "rating"],
      carried: ["something-newer"],
    });
  });

  it("splits an empty list into nothing and nothing", () => {
    expect(partitionHiddenItems([])).toEqual({ selected: [], carried: [] });
  });

  it("carries a known name a control is not currently offering", () => {
    const offered = HIDDEN_ITEMS.filter((item) => item !== "timers");

    expect(partitionHiddenItems(["timers", "rating"], offered)).toEqual({
      selected: ["rating"],
      carried: ["timers"],
    });
  });
});

describe("hiddenItemVisibility", () => {
  it("shows what is not hidden", () => {
    expect(hiddenItemVisibility(["rating", "favorites", "fromANewerVersion"])).toMatchObject({
      showRatings: false,
      showFavorites: false,
      showNotes: true,
    });
  });
});
