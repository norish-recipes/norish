import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-reanimated", () => ({
  ReduceMotion: { System: "system", Never: "never" },
  withTiming: (to: number, config: object) => ({ timing: to, config }),
  withDelay: (delay: number, animation: object) => ({ delay, animation }),
  withSequence: (...steps: object[]) => ({ steps }),
}));

const { stepsThrough, timedTo } = await import("@/lib/motion/timed");

describe("timedTo", () => {
  it("snaps under Reduce Motion unless kept, keeping Reanimated's own easing unless given", () => {
    expect(timedTo(1, 240)).toEqual({
      timing: 1,
      config: { duration: 240, reduceMotion: "system" },
    });
    expect(timedTo(0, 240, { keep: true })).toEqual({
      timing: 0,
      config: { duration: 240, reduceMotion: "never" },
    });
  });

  it("waits its delay first", () => {
    const linear = (t: number) => t;

    expect(timedTo(900, 900, { easing: linear, delay: 300, keep: true })).toEqual({
      delay: 300,
      animation: { timing: 900, config: { duration: 900, reduceMotion: "never", easing: linear } },
    });
  });
});

describe("stepsThrough", () => {
  it("runs through each stop in turn", () => {
    expect(stepsThrough([-10, 0], 50)).toEqual({
      steps: [
        { timing: -10, config: { duration: 50, reduceMotion: "system" } },
        { timing: 0, config: { duration: 50, reduceMotion: "system" } },
      ],
    });
  });
});
