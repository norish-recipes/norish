import { describe, expect, it } from "vitest";

import { timerCookStep } from "../utils/timer-step";

describe("timerCookStep", () => {
  it("opens the step the timer was started from", () => {
    expect(timerCookStep({ stepIndex: 3 })).toBe(3);
    expect(timerCookStep({ stepIndex: 0 })).toBe(0);
  });

  it("opens the first step for a timer with none", () => {
    expect(timerCookStep({})).toBe(0);
  });
});
