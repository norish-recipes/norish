import { describe, expect, it } from "vitest";

import { pagerPose, PEEK_OPACITY, PEEK_SCALE, PEEK_SLOT, settleTarget } from "../utils/cook-pager";

describe("pagerPose", () => {
  it("rests with the current step full size and both peeks faded", () => {
    const { top, current, bottom } = pagerPose(0, 400);

    expect(current).toEqual({ y: 0, scale: 1, opacity: 1 });
    expect(top).toEqual({ y: 0, scale: PEEK_SCALE, opacity: PEEK_OPACITY });
    expect(bottom).toEqual({ y: 0, scale: PEEK_SCALE, opacity: PEEK_OPACITY });
  });

  it("raises the next peek into the centre while the current shrinks into the upper peek", () => {
    const { top, current, bottom } = pagerPose(1, 400);

    expect(bottom).toEqual({ y: -400, scale: 1, opacity: 1 });
    expect(current.y).toBe(-PEEK_SLOT);
    expect(current.scale).toBeCloseTo(PEEK_SCALE);
    expect(current.opacity).toBeCloseTo(PEEK_OPACITY);
    expect(top.opacity).toBe(0);
  });

  it("runs the reverse going back", () => {
    const { top, current, bottom } = pagerPose(-1, 400);

    expect(top).toEqual({ y: PEEK_SLOT, scale: 1, opacity: 1 });
    expect(current.y).toBe(400);
    expect(current.scale).toBeCloseTo(PEEK_SCALE);
    expect(bottom.opacity).toBe(0);
  });

  it("stays at the end pose past one step", () => {
    expect(pagerPose(1.6, 400)).toEqual(pagerPose(1, 400));
    expect(pagerPose(-1.6, 400)).toEqual(pagerPose(-1, 400));
  });
});

describe("settleTarget", () => {
  it("snaps to the nearer step when released slowly", () => {
    expect(settleTarget(0.4, 0, -1, 1)).toBe(0);
    expect(settleTarget(0.6, 0, -1, 1)).toBe(1);
  });

  it("lets a flick carry a short drag to the next step", () => {
    expect(settleTarget(0.2, 3, -1, 1)).toBe(1);
    expect(settleTarget(-0.2, -3, -1, 1)).toBe(-1);
  });

  it("stays put where there is no step to go to", () => {
    expect(settleTarget(0.9, 5, -1, 0)).toBe(0);
    expect(settleTarget(-0.9, -5, 0, 1)).toBe(0);
  });
});
