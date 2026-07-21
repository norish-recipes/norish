import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const probeMock = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
let wsStatus: "idle" | "connecting" | "connected" | "disconnected" = "idle";

vi.mock("@/app/providers/trpc-provider", () => ({
  useConnectionStatus: () => ({ status: wsStatus, isConnected: wsStatus === "connected" }),
}));

vi.mock("@/lib/connectivity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/connectivity")>();

  return { ...actual, probeBackendReachable: probeMock };
});

import { ConnectivityProvider, useConnectivity } from "@/app/providers/connectivity-provider";

function StateProbe() {
  const { state } = useConnectivity();

  return <div data-testid="state">{state}</div>;
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
});
