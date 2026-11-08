// The probe loop: a slow heartbeat while Live, backoff while Offline. Hints (socket drop,
// device network) only call `probeNow`; the probe stays the sole verdict.

import type { ConnectivitySnapshot } from "./connectivity-machine";
import { nextProbeDelayMs, reduceProbeResult } from "./connectivity-machine";

export interface ConnectivityLoop {
  /** Probe now instead of at the next scheduled tick; coalesces with one in flight. */
  probeNow(): void;
  stop(): void;
}

export function startConnectivityLoop({
  probe,
  initial,
  onVerdict,
}: {
  probe: () => Promise<boolean>;
  initial: ConnectivitySnapshot;
  /** Every probe's folded snapshot, with whether it found the backend reachable. */
  onVerdict: (snapshot: ConnectivitySnapshot, reachable: boolean) => void;
}): ConnectivityLoop {
  let snapshot = initial;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let rerunRequested = false;

  const runProbe = async () => {
    if (cancelled || inFlight) {
      // A probe already running: remember the request and coalesce it.
      if (inFlight) {
        rerunRequested = true;
      }

      return;
    }

    inFlight = true;

    const reachable = await probe();

    inFlight = false;

    if (cancelled) {
      return;
    }

    snapshot = reduceProbeResult(snapshot, reachable);
    onVerdict(snapshot, reachable);

    if (rerunRequested) {
      rerunRequested = false;
      void runProbe();

      return;
    }

    timer = setTimeout(() => void runProbe(), nextProbeDelayMs(snapshot));
  };

  const probeNow = () => {
    if (cancelled) {
      return;
    }

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    void runProbe();
  };

  // Probe once immediately so the first verdict is established quickly.
  void runProbe();

  return {
    probeNow,
    stop() {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    },
  };
}
