import { describe, expect, it } from "vitest";

import {
  clampToReach,
  HANDOVER,
  onStep,
  PEEK_MAX_HEIGHT,
  PEEK_OPACITY,
  PEEK_SCALE,
  PEEK_SLOT,
  settleTarget,
  slotPose,
  springStart,
  stepReach,
} from "../utils/cook-pager";

const COLUMN = 600;
const PEEK = 110;

describe("slotPose", () => {
  it("rests the current step centred at full size with its peek hidden", () => {
    expect(slotPose(0, COLUMN, PEEK)).toEqual({
      y: 0,
      scale: 1,
      fullOpacity: 1,
      peekOpacity: 0,
    });
  });

  it("rests a neighbour as a faded peek against its slot's inner edge", () => {
    const above = slotPose(-1, COLUMN, PEEK);
    const below = slotPose(1, COLUMN, PEEK);

    expect(above).toMatchObject({ scale: PEEK_SCALE, fullOpacity: 0, peekOpacity: PEEK_OPACITY });
    expect(COLUMN / 2 + above.y + (PEEK_SCALE * PEEK) / 2).toBeCloseTo(PEEK_SLOT);
    expect(COLUMN / 2 + below.y - (PEEK_SCALE * PEEK) / 2).toBeCloseTo(COLUMN - PEEK_SLOT);
  });

  it("keeps the tallest peek a step lays out inside its slot", () => {
    const above = slotPose(-1, COLUMN, PEEK_MAX_HEIGHT);
    const below = slotPose(1, COLUMN, PEEK_MAX_HEIGHT);

    expect(COLUMN / 2 + above.y - (PEEK_SCALE * PEEK_MAX_HEIGHT) / 2).toBeGreaterThanOrEqual(0);
    expect(COLUMN / 2 + below.y + (PEEK_SCALE * PEEK_MAX_HEIGHT) / 2).toBeLessThanOrEqual(COLUMN);
  });

  it("fades a full step out as it shrinks, before its peek fades in", () => {
    const outgoing = slotPose(-0.5, COLUMN, PEEK);

    expect(outgoing.fullOpacity).toBeGreaterThan(0.4);
    expect(outgoing.peekOpacity).toBe(0);
    expect(outgoing.scale).toBeCloseTo((1 + PEEK_SCALE) / 2);
    expect(slotPose(HANDOVER, COLUMN, PEEK)).toMatchObject({ fullOpacity: 0, peekOpacity: 0 });
    expect(slotPose(0.85, COLUMN, PEEK).peekOpacity).toBeCloseTo(PEEK_OPACITY / 2);
  });

  it("never shows a slot's full step and its peek at once", () => {
    for (let offset = -2; offset <= 2; offset += 0.01) {
      const { fullOpacity, peekOpacity } = slotPose(offset, COLUMN, PEEK);

      expect(Math.min(fullOpacity, peekOpacity)).toBeCloseTo(0, 9);
    }
  });

  it("moves continuously from a peek to off screen and hides there", () => {
    const peek = slotPose(1, COLUMN, PEEK);

    expect(slotPose(1.001, COLUMN, PEEK).y).toBeCloseTo(peek.y, 0);
    expect(slotPose(2, COLUMN, PEEK)).toMatchObject({ fullOpacity: 0, peekOpacity: 0 });
    expect(slotPose(3, COLUMN, PEEK)).toEqual(slotPose(2, COLUMN, PEEK));
  });
});

describe("settleTarget", () => {
  const reach = { first: 2, last: 4 };

  it("snaps to the nearer step when released slowly", () => {
    expect(settleTarget(3.4, 0, reach)).toBe(3);
    expect(settleTarget(3.6, 0, reach)).toBe(4);
  });

  it("lets a flick carry a short drag to the next step", () => {
    expect(settleTarget(3.2, 3, reach)).toBe(4);
    expect(settleTarget(2.8, -3, reach)).toBe(2);
  });

  it("stays within the steps a drag can reach", () => {
    expect(settleTarget(3.9, 5, { first: 2, last: 3 })).toBe(3);
    expect(settleTarget(0.1, -5, { first: 0, last: 1 })).toBe(0);
  });
});

describe("stepReach", () => {
  it("reaches one step either side, within the recipe", () => {
    expect(stepReach(2, 5)).toEqual({ first: 1, last: 3 });
    expect(stepReach(0, 5)).toEqual({ first: 0, last: 1 });
    expect(stepReach(4, 5)).toEqual({ first: 3, last: 4 });
  });

  it("holds a drag within that reach", () => {
    const reach = stepReach(2, 5);

    expect(clampToReach(0.4, reach)).toBe(1);
    expect(clampToReach(2.6, reach)).toBe(2.6);
    expect(clampToReach(3.7, reach)).toBe(3);
  });
});

describe("onStep", () => {
  it("tells the current step's region from the peek slots", () => {
    expect(onStep(COLUMN / 2, COLUMN)).toBe(true);
    expect(onStep(PEEK_SLOT / 2, COLUMN)).toBe(false);
    expect(onStep(COLUMN - PEEK_SLOT / 2, COLUMN)).toBe(false);
  });
});

describe("springStart", () => {
  it("springs a step or less from where the column is", () => {
    expect(springStart(3.4, 4)).toBe(3.4);
    expect(springStart(5, 4)).toBe(5);
  });

  it("starts a longer jump one page before its step, in its direction", () => {
    expect(springStart(2, 7)).toBe(6);
    expect(springStart(7, 1)).toBe(2);
  });
});
