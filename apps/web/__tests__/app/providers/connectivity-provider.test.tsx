import { useEffect } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ConnectivityProvider, useConnectivity } from "@/app/providers/connectivity-provider";
import { LIVE_PROBE_INTERVAL_MS } from "@/lib/connectivity";

const probeMock = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
let wsStatus: "idle" | "connected" | "disconnected" = "idle";

vi.mock("@/app/providers/trpc-provider", () => ({
  useConnectionStatus: () => ({ status: wsStatus, isConnected: wsStatus === "connected" }),
}));

vi.mock("@/lib/connectivity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/connectivity")>();

  return { ...actual, probeBackendReachable: probeMock };
});

function StateProbe() {
  const { state } = useConnectivity();

  return <div data-testid="state">{state}</div>;
}

function LiveProbeSubscriber({ onLive }: { onLive: () => void }) {
  const { subscribeLiveProbes } = useConnectivity();

  useEffect(() => subscribeLiveProbes(onLive), [subscribeLiveProbes, onLive]);

  return null;
}

let probeNowHandle: () => void = () => {};

function ProbeNowHandle() {
  const { probeNow } = useConnectivity();

  probeNowHandle = probeNow;

  return null;
}

/** Flush the microtasks/timers queued by the probe loop. */
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ConnectivityProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    probeMock.mockReset();
    wsStatus = "idle";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("flips to Offline when the mount probe fails and back to Live on recovery", async () => {
    probeMock.mockResolvedValue(false);

    render(
      <ConnectivityProvider>
        <StateProbe />
      </ConnectivityProvider>
    );

    await settle();
    expect(screen.getByTestId("state")).toHaveTextContent("offline");

    // Backend recovers; the next backoff probe should restore Live.
    probeMock.mockResolvedValue(true);
    await settle(2000);
    expect(screen.getByTestId("state")).toHaveTextContent("live");
  });

  it("treats a WebSocket drop as a hint and re-probes immediately", async () => {
    probeMock.mockResolvedValue(true);
    wsStatus = "connected";

    const { rerender } = render(
      <ConnectivityProvider>
        <StateProbe />
      </ConnectivityProvider>
    );

    await settle();
    expect(screen.getByTestId("state")).toHaveTextContent("live");

    // Backend goes away: the WS reports a drop and probes now fail. The hint
    // should trigger a probe well before the 30s Live heartbeat would.
    probeMock.mockClear();
    probeMock.mockResolvedValue(false);
    wsStatus = "disconnected";
    rerender(
      <ConnectivityProvider>
        <StateProbe />
      </ConnectivityProvider>
    );

    await settle();
    expect(probeMock).toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("offline");
  });

  it("tells live-probe subscribers about every reachable verdict, heartbeat included", async () => {
    probeMock.mockResolvedValue(true);
    const onLive = vi.fn();

    render(
      <ConnectivityProvider>
        <LiveProbeSubscriber onLive={onLive} />
      </ConnectivityProvider>
    );

    await settle();
    expect(onLive).toHaveBeenCalledTimes(1);

    // Still Live: the state does not change, but the verdict is still news to
    // whoever holds queued work.
    await settle(LIVE_PROBE_INTERVAL_MS);
    expect(onLive).toHaveBeenCalledTimes(2);

    probeMock.mockResolvedValue(false);
    await settle(LIVE_PROBE_INTERVAL_MS);
    expect(onLive).toHaveBeenCalledTimes(2);
  });

  it("probes out of band when asked to", async () => {
    probeMock.mockResolvedValue(true);

    render(
      <ConnectivityProvider>
        <ProbeNowHandle />
      </ConnectivityProvider>
    );

    await settle();
    expect(probeMock).toHaveBeenCalledTimes(1);

    act(() => probeNowHandle());
    await settle();
    expect(probeMock).toHaveBeenCalledTimes(2);
  });
});
