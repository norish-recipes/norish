import { describe, expect, it } from "vitest";

import {
  measurementChoices,
  offeredHiddenItems,
  shownMeasurement,
  toggledHiddenItems,
} from "../utils/preferences-rules";

describe("the measurements choices", () => {
  it("offer conversion with AI only where AI is on", () => {
    expect(measurementChoices(true)).toEqual(["off", "metric", "us", "metricWithAI", "usWithAI"]);
    expect(measurementChoices(false)).toEqual(["off", "metric", "us"]);
  });

  it("read a choice of AI made earlier as the same system without it", () => {
    expect(shownMeasurement("usWithAI", false)).toBe("us");
    expect(shownMeasurement("usWithAI", true)).toBe("usWithAI");
    expect(shownMeasurement("off", false)).toBe("off");
  });
});

describe("the hidden items", () => {
  it("leave out timers when the deployment has them off", () => {
    expect(offeredHiddenItems(true)).toContain("timers");
    expect(offeredHiddenItems(false)).not.toContain("timers");
    expect(offeredHiddenItems(false)).toHaveLength(offeredHiddenItems(true).length - 1);
  });

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
