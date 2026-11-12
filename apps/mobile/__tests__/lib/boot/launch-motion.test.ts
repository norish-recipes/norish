import { resolveLaunchMotion, resolveSloganStart, stepLaunchClock } from "@/lib/boot/launch-motion";
import { describe, expect, it } from "vitest";

describe("resolveLaunchMotion", () => {
  it("holds while the boot phase has no handoff yet", () => {
    expect(resolveLaunchMotion(null, false, 120)).toBeNull();
  });

  it("glides when Server address has measured its brand", () => {
    expect(resolveLaunchMotion("glide", false, 120)).toBe("glide");
  });

  it("fades when no glide target arrived by the end of the hold", () => {
    expect(resolveLaunchMotion("glide", false, null)).toBe("fade");
  });

  it("fades under Reduce Motion and for every other handoff", () => {
    expect(resolveLaunchMotion("glide", true, 120)).toBe("fade");
    expect(resolveLaunchMotion("fade", false, 120)).toBe("fade");
  });
});

describe("resolveSloganStart", () => {
  it("starts the slogan's fade on the first frame once the device's messages are in", () => {
    expect(resolveSloganStart(null, 0, true, 500)).toBe(0);
  });

  it("holds the slogan while the messages load, then starts it where the clock is", () => {
    expect(resolveSloganStart(null, 200, false, 500)).toBeNull();
    expect(resolveSloganStart(null, 240, true, 500)).toBe(240);
  });

  it("starts it by the latest start anyway, so it is in by the hold's end", () => {
    expect(resolveSloganStart(null, 510, false, 500)).toBe(500);
  });

  it("keeps a start once made", () => {
    expect(resolveSloganStart(120, 600, false, 500)).toBe(120);
  });
});

describe("stepLaunchClock", () => {
  it("advances by the frame's elapsed time", () => {
    expect(stepLaunchClock(100, 16.7, 900)).toBeCloseTo(116.7);
  });

  it("advances at most two 60 Hz frames, so a stalled frame can't skip the launch", () => {
    expect(stepLaunchClock(0, 195, 900)).toBeCloseTo(1000 / 30);
  });

  it("stops at the stop point", () => {
    expect(stepLaunchClock(890, 16.7, 900)).toBe(900);
  });

  it("stays put on a frame with no elapsed time yet", () => {
    expect(stepLaunchClock(100, null, 900)).toBe(100);
  });

  it("never moves back when the stop point is behind it", () => {
    expect(stepLaunchClock(1200, 16.7, 900)).toBe(1200);
  });
});
