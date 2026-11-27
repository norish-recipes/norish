import { describe, expect, it } from "vitest";

import { offeredHiddenItems } from "@norish/shared-react/reader";

import { toggledHiddenItems } from "../utils/preferences-rules";

describe("the hidden items", () => {
  it("flip one, keeping the others in contract order", () => {
    const offered = offeredHiddenItems(true);

    expect(toggledHiddenItems(["notes"], offered, "provenance")).toEqual(["provenance", "notes"]);
    expect(toggledHiddenItems(["provenance", "notes"], offered, "provenance")).toEqual(["notes"]);
  });

  it("carry a stored name that is not on offer, so turning timers back on restores it", () => {
    const offered = offeredHiddenItems(false);

    expect(toggledHiddenItems(["timers", "notes"], offered, "rating")).toEqual([
      "notes",
      "rating",
      "timers",
    ]);
    expect(toggledHiddenItems(["newer"], offered, "notes")).toEqual(["notes", "newer"]);
  });
});
