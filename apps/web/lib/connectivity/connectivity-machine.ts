/**
 * Pure Live/Offline state machine for the web connectivity runtime.
 *
 * "Offline" means the Norish backend's HTTP surface is unreachable — the verdict
 * comes from probing `/api/v1/health` (see {@link ./probe}), never from
 * `navigator.onLine`, which measures the internet rather than the backend.
 *
 * This module is intentionally free of React and DOM concerns so the transition
 * and backoff logic can be unit-tested in isolation; the timers, fetches and
 * WebSocket hints live in the provider.
 */

export type ConnectivityState = "live" | "offline";

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  /** Consecutive failed probes. Always 0 while Live; drives the Offline backoff. */
  failureStreak: number;
}

/** Optimistic starting point: assume Live until the first probe says otherwise. */
export const INITIAL_CONNECTIVITY: ConnectivitySnapshot = { state: "live", failureStreak: 0 };

/** Slow heartbeat while Live, to notice a silently-dead backend. */
export const LIVE_PROBE_INTERVAL_MS = 30_000;
/** First retry delay after going Offline. */
export const OFFLINE_BACKOFF_MIN_MS = 2_000;
/** Ceiling for the Offline backoff. */
export const OFFLINE_BACKOFF_MAX_MS = 30_000;
/**
 * Upper bound on the tracked failure streak. Once reached, the backoff is at its
 * maximum, so we stop growing the streak and return a stable snapshot reference
 * to avoid needless re-renders during a long Offline stretch.
 */
export const OFFLINE_FAILURE_STREAK_CAP = 6;

/**
 * Fold a probe outcome into the current snapshot.
 *
 * A successful probe returns to Live (streak reset); the shared reference is
 * kept when already Live so React consumers don't re-render on every heartbeat.
 */
export function reduceProbeResult(
  prev: ConnectivitySnapshot,
  reachable: boolean
): ConnectivitySnapshot {
  if (reachable) {
    return prev.state === "live" ? prev : INITIAL_CONNECTIVITY;
  }

  if (prev.state === "offline" && prev.failureStreak >= OFFLINE_FAILURE_STREAK_CAP) {
    return prev;
  }

  return {
    state: "offline",
    failureStreak: Math.min(prev.failureStreak + 1, OFFLINE_FAILURE_STREAK_CAP),
  };
}

/** How long to wait before the next probe, given the current snapshot. */
export function nextProbeDelayMs(snapshot: ConnectivitySnapshot): number {
  if (snapshot.state === "live") {
    return LIVE_PROBE_INTERVAL_MS;
  }

  const streak = Math.max(1, snapshot.failureStreak);
  const backoff = OFFLINE_BACKOFF_MIN_MS * 2 ** (streak - 1);

  return Math.min(backoff, OFFLINE_BACKOFF_MAX_MS);
}
