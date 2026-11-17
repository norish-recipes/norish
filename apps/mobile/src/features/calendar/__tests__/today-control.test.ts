import { describe, expect, it } from "vitest";

import { todayDirection } from "../utils/today-control";

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
