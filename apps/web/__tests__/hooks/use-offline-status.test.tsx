import type { ReactNode } from "react";
import { useOfflineStatus } from "@/components/navbar/offline-status/use-offline-status";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Shared mutable state for the module mocks. `calls` records the reconnect
 * steps in execution order — the ordering guarantee (drain → invalidate → warm)
 * is the point of several tests, so runReconnectSequence itself stays real.
 */
const h = vi.hoisted(() => ({
  connectivity: {
    posture: "live" as "live" | "offline" | "offline-forced",
    isLive: true,
    isOffline: false,
    isForced: false,
  },
  owner: "user-1" as string | null,
  outboxEntries: [] as Array<{ seq: number; path: string; status: string }>,
  calls: [] as string[],
  probeBackendReachable: vi.fn(async () => true),
  setOfflineForced: vi.fn(),
  processQueue: vi.fn(async () => {}),
  retryParkedEntries: vi.fn(async () => {}),
  discardAllEntries: vi.fn(async () => 0),
  topUpWarmSet: vi.fn(async () => {}),
  wipeReadCache: vi.fn(async () => {}),
  readLastWarmedAt: vi.fn(async (): Promise<number | null> => null),
}));

vi.mock("@/app/providers/connectivity-provider", () => ({
  useConnectivity: () => h.connectivity,
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({}),
}));

vi.mock("@/lib/connectivity", () => ({
  probeBackendReachable: h.probeBackendReachable,
  setOfflineForced: h.setOfflineForced,
}));

vi.mock("@/lib/outbox", async () => {
  const { runReconnectSequence } =
    await vi.importActual<typeof import("@/lib/outbox/reconnect")>("@/lib/outbox/reconnect");

  return {
    runReconnectSequence,
    processQueue: h.processQueue,
    retryParkedEntries: h.retryParkedEntries,
    discardAllEntries: h.discardAllEntries,
    isReplaying: () => false,
    subscribeReplayState: () => () => {},
    outboxStore: {
      forOwner: vi.fn(async () => h.outboxEntries),
      subscribe: vi.fn(() => () => {}),
    },
  };
});

vi.mock("@/lib/query-cache", () => ({
  activeCacheOwner: () => h.owner,
  getOfflineCacheCounts: () => ({ recipes: 2, groceries: 3, stores: 1, plannedThisWeek: 4 }),
  readLastWarmedAt: h.readLastWarmedAt,
  topUpWarmSet: h.topUpWarmSet,
  wipeReadCache: h.wipeReadCache,
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderStatus() {
  return renderHook(() => useOfflineStatus(), { wrapper });
}

function setConnectivity(posture: "live" | "offline" | "offline-forced") {
  h.connectivity.posture = posture;
  h.connectivity.isLive = posture === "live";
  h.connectivity.isOffline = posture !== "live";
  h.connectivity.isForced = posture === "offline-forced";
}

const originalLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  setConnectivity("live");
  h.owner = "user-1";
  h.outboxEntries = [];
  h.calls = [];
  h.probeBackendReachable.mockResolvedValue(true);
  h.readLastWarmedAt.mockResolvedValue(null);
  h.processQueue.mockImplementation(async () => {
    h.calls.push("drain");
  });
  h.topUpWarmSet.mockImplementation(async () => {
    h.calls.push("warm");
  });

  queryClient = new QueryClient();
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(async () => {
    h.calls.push("invalidate");
  });

  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload: vi.fn() },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("useOfflineStatus", () => {
  it("summarizes the live Outbox by status", async () => {
    h.outboxEntries = [
      { seq: 1, path: "groceries.create", status: "pending" },
      { seq: 2, path: "groceries.update", status: "pending" },
      { seq: 3, path: "recipes.update", status: "parked" },
      { seq: 4, path: "calendar.move", status: "conflicted" },
    ];

    const { result } = renderStatus();

    await waitFor(() => expect(result.current.outbox.total).toBe(4));
    expect(result.current.outbox.pending).toBe(2);
    expect(result.current.outbox.parked).toBe(1);
    expect(result.current.outbox.conflicted).toBe(1);
  });

  it("syncNow runs the Reconnect Sequence strictly as drain → invalidate → warm", async () => {
    h.readLastWarmedAt.mockResolvedValue(1234);

    const { result } = renderStatus();

    await act(() => result.current.syncNow());

    expect(h.calls).toEqual(["drain", "invalidate", "warm"]);
    // The sequence's warm stamped last-warmed; the modal reflects it.
    expect(result.current.lastWarmedAt).toBe(1234);
  });

  it("syncNow does not probe while Live", async () => {
    const { result } = renderStatus();

    await act(() => result.current.syncNow());

    expect(h.probeBackendReachable).not.toHaveBeenCalled();
  });

  it("syncNow probes first while Offline and stops when unreachable", async () => {
    setConnectivity("offline");
    h.probeBackendReachable.mockResolvedValue(false);

    const { result } = renderStatus();

    await act(() => result.current.syncNow());

    expect(h.probeBackendReachable).toHaveBeenCalled();
    expect(h.calls).toEqual([]);
    expect(result.current.isSyncing).toBe(false);
  });

  it("syncNow drains after a successful probe while Offline", async () => {
    setConnectivity("offline");

    const { result } = renderStatus();

    await act(() => result.current.syncNow());

    expect(h.calls).toEqual(["drain", "invalidate", "warm"]);
  });

  it("syncNow is inert under the dev override — the transport is blocked", async () => {
    setConnectivity("offline-forced");

    const { result } = renderStatus();

    await act(() => result.current.syncNow());

    expect(h.probeBackendReachable).not.toHaveBeenCalled();
    expect(h.calls).toEqual([]);
  });

  it("wipeCache clears the read cache, re-warms while Live and re-reads the stamp", async () => {
    h.readLastWarmedAt.mockResolvedValue(5678);

    const { result } = renderStatus();

    await act(() => result.current.wipeCache());

    expect(h.wipeReadCache).toHaveBeenCalledWith(queryClient);
    expect(h.topUpWarmSet).toHaveBeenCalled();
    expect(result.current.lastWarmedAt).toBe(5678);
  });

  it("wipeCache while Offline leaves the cache empty without re-warming", async () => {
    setConnectivity("offline");

    const { result } = renderStatus();

    await act(() => result.current.wipeCache());

    expect(h.wipeReadCache).toHaveBeenCalled();
    expect(h.topUpWarmSet).not.toHaveBeenCalled();
    expect(result.current.lastWarmedAt).toBeNull();
  });

  it("discardAll removes the owner's entries and reconciles the cache", async () => {
    const { result } = renderStatus();

    await act(() => result.current.discardAll());

    expect(h.discardAllEntries).toHaveBeenCalledWith("user-1");
    expect(h.calls).toContain("invalidate");
  });

  it("retryAll un-parks for the active owner", async () => {
    const { result } = renderStatus();

    await act(() => result.current.retryAll());

    expect(h.retryParkedEntries).toHaveBeenCalledWith("user-1");
  });

  it("entering the dev override persists the flag and reloads", () => {
    const { result } = renderStatus();

    act(() => result.current.setForcedOffline(true));

    expect(h.setOfflineForced).toHaveBeenCalledWith(true);
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("exiting the dev override clears the flag without a reload (organic reconnect)", () => {
    setConnectivity("offline-forced");

    const { result } = renderStatus();

    act(() => result.current.setForcedOffline(false));

    expect(h.setOfflineForced).toHaveBeenCalledWith(false);
    // No reload: the probe loop, held subscriptions and the controller's
    // Offline→Live effect handle the exit (ADR-0007).
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
