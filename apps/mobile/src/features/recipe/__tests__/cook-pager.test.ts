import { describe, expect, it } from "vitest";

import {
  PEEK_OPACITY,
  PEEK_SCALE,
  PEEK_SLOT,
  settleTarget,
  slotPose,
  springStart,
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

  it("fades a full step out as it shrinks, not over the peek that rises", () => {
    const outgoing = slotPose(-0.5, COLUMN, PEEK);

    expect(outgoing.fullOpacity).toBeCloseTo(0.5);
    expect(outgoing.scale).toBeCloseTo((1 + PEEK_SCALE) / 2);
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
