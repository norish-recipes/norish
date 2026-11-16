import { describe, expect, it } from "vitest";

import { accessoryPlan } from "../utils/accessory-plan";

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
