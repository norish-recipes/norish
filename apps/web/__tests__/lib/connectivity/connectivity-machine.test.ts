import { describe, expect, it } from "vitest";

import {
  INITIAL_CONNECTIVITY,
  LIVE_PROBE_INTERVAL_MS,
  nextProbeDelayMs,
  OFFLINE_BACKOFF_MAX_MS,
  OFFLINE_BACKOFF_MIN_MS,
  OFFLINE_FAILURE_STREAK_CAP,
  reduceProbeResult,
} from "@/lib/connectivity/connectivity-machine";

describe("reduceProbeResult", () => {
  it("starts Live with no failures", () => {
    expect(INITIAL_CONNECTIVITY).toEqual({ state: "live", failureStreak: 0 });
  });

  it("stays Live on a successful probe and keeps the same reference (no re-render)", () => {
    const next = reduceProbeResult(INITIAL_CONNECTIVITY, true);

    expect(next).toBe(INITIAL_CONNECTIVITY);
  });

  it("flips to Offline with a failure streak of 1 on the first failed probe", () => {
    expect(reduceProbeResult(INITIAL_CONNECTIVITY, false)).toEqual({
      state: "offline",
      failureStreak: 1,
    });
  });

  it("increments the failure streak on consecutive failures", () => {
    const first = reduceProbeResult(INITIAL_CONNECTIVITY, false);
    const second = reduceProbeResult(first, false);

    expect(second).toEqual({ state: "offline", failureStreak: 2 });
  });

  it("recovers to Live (streak reset) on a successful probe while Offline", () => {
    const offline = { state: "offline" as const, failureStreak: 4 };

    expect(reduceProbeResult(offline, true)).toEqual({ state: "live", failureStreak: 0 });
  });

  it("caps the failure streak and returns a stable reference once capped", () => {
    let snap = INITIAL_CONNECTIVITY;

    for (let i = 0; i < OFFLINE_FAILURE_STREAK_CAP + 5; i++) {
      snap = reduceProbeResult(snap, false);
    }

    expect(snap.failureStreak).toBe(OFFLINE_FAILURE_STREAK_CAP);

    const again = reduceProbeResult(snap, false);

    expect(again).toBe(snap);
  });
});

describe("nextProbeDelayMs", () => {
  it("uses the slow heartbeat interval while Live", () => {
    expect(nextProbeDelayMs(INITIAL_CONNECTIVITY)).toBe(LIVE_PROBE_INTERVAL_MS);
  });

  it("backs off exponentially while Offline", () => {
    expect(nextProbeDelayMs({ state: "offline", failureStreak: 1 })).toBe(OFFLINE_BACKOFF_MIN_MS);
    expect(nextProbeDelayMs({ state: "offline", failureStreak: 2 })).toBe(OFFLINE_BACKOFF_MIN_MS * 2);
    expect(nextProbeDelayMs({ state: "offline", failureStreak: 3 })).toBe(OFFLINE_BACKOFF_MIN_MS * 4);
    expect(nextProbeDelayMs({ state: "offline", failureStreak: 4 })).toBe(OFFLINE_BACKOFF_MIN_MS * 8);
  });

  it("caps the Offline backoff at the maximum", () => {
    expect(nextProbeDelayMs({ state: "offline", failureStreak: OFFLINE_FAILURE_STREAK_CAP })).toBe(
      OFFLINE_BACKOFF_MAX_MS
    );
    expect(nextProbeDelayMs({ state: "offline", failureStreak: 99 })).toBe(OFFLINE_BACKOFF_MAX_MS);
  });
});
