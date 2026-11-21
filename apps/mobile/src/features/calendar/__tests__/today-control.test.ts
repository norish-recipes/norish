import { describe, expect, it } from "vitest";

import { todayControlPlace, todayDirection } from "../utils/today-control";

describe("todayDirection", () => {
  it("is null while today's card is on screen, or nothing is measured yet", () => {
    expect(todayDirection(["2026-11-16", "2026-11-17"], "2026-11-17", true)).toBeNull();
    expect(todayDirection([], "2026-11-17", true)).toBeNull();
  });

  it("points up when the screen shows later days, down when it shows earlier ones", () => {
    expect(todayDirection(["2026-11-24", "2026-11-25"], "2026-11-17", true)).toBe("up");
    expect(todayDirection(["2026-11-03"], "2026-11-17", true)).toBe("down");
  });

  it("is null when today is not among the rows", () => {
    expect(todayDirection(["2026-11-24"], "2026-11-17", false)).toBeNull();
  });
});

describe("todayControlPlace", () => {
  // The accessory's top on an iPhone 17: 76 pt up minimised, 139 pt expanded.
  it("sits 7 pt above the accessory, the tab bar's gap under it,, ending where the Search button ends, in either placement", () => {
    expect(todayControlPlace(34, true)).toEqual({ right: 28, bottom: 83 });
    expect(todayControlPlace(34, false)).toEqual({ right: 21, bottom: 146 });
  });

  it("drops with the accessory where there is no home indicator", () => {
    expect(todayControlPlace(0, true).bottom).toBe(63);
    expect(todayControlPlace(0, false).bottom).toBe(112);
  });
});
