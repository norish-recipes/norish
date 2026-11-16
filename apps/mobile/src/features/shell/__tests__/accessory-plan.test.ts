import { describe, expect, it } from "vitest";

import { accessoryPlan, labelFits } from "../utils/accessory-plan";

describe("accessoryPlan", () => {
  it("holds the tab's add action alone while no timer exists", () => {
    expect(accessoryPlan("/", false)).toEqual({ add: "recipes", capsule: false });
    expect(accessoryPlan("/groceries", false)).toEqual({ add: "groceries", capsule: false });
    expect(accessoryPlan("/calendar", false)).toEqual({ add: "calendar", capsule: false });
  });

  it("adds the timer capsule on every tab while a timer exists", () => {
    expect(accessoryPlan("/", true)).toEqual({ add: "recipes", capsule: true });
    expect(accessoryPlan("/groceries/stores", true)).toEqual({ add: "groceries", capsule: true });
    expect(accessoryPlan("/calendar", true)).toEqual({ add: "calendar", capsule: true });
    expect(accessoryPlan("/settings", true)).toEqual({ add: "recipes", capsule: true });
  });

  it("shows nothing on the Pantry without a timer, and the capsule alone with one", () => {
    expect(accessoryPlan("/groceries/pantry", false)).toBeNull();
    expect(accessoryPlan("/groceries/food", false)).toBeNull();
    expect(accessoryPlan("/groceries/pantry", true)).toEqual({ add: null, capsule: true });
  });
});

describe("labelFits", () => {
  it("shows the label until the room and the label are measured", () => {
    expect(labelFits(null, 80)).toBe(true);
    expect(labelFits(120, null)).toBe(true);
  });

  it("keeps the label when sides, icon, gap and label fit the room", () => {
    // 12 + 22 + 8 + 80 + 12 = 134
    expect(labelFits(134, 80)).toBe(true);
    expect(labelFits(133, 80)).toBe(false);
  });

  it("drops a long translation where a short label fits", () => {
    expect(labelFits(150, 40)).toBe(true);
    expect(labelFits(150, 140)).toBe(false);
  });
});
