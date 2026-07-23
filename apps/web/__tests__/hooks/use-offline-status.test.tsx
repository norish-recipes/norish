import { useOfflineStatus } from "@/components/navbar/offline-status/use-offline-status";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  connectivity: {
    posture: "live" as "live" | "offline" | "offline-forced",
    isLive: true,
    isOffline: false,
    isForced: false,
  },
  owner: "user-1" as string | null,
  outboxEntries: [] as Array<{ seq: number; path: string; status: string }>,
  syncing: false,
  probeBackendReachable: vi.fn(async () => true),
  setOfflineForced: vi.fn(),
  recover: vi.fn(async () => {}),
  requeueParkedEntries: vi.fn(async () => {}),
  discardAllEntries: vi.fn(async () => 0),
  warmSetTopUp: vi.fn(async () => "complete" as const),
  warmSetInspect: vi.fn(async () => ({
    recipes: 2,
    groceries: 3,
    stores: 1,
    plannedThisWeek: 4,
    lastCompletedAt: null as number | null,
  })),
  resetOfflineCopy: vi.fn(async () => {}),
}));

vi.mock("@/app/providers/connectivity-provider", () => ({
  useConnectivity: () => h.connectivity,
}));

vi.mock("@/app/providers/recovery-provider", () => ({
  useRecovery: () => ({
    recover: h.recover,
    isSyncing: () => h.syncing,
    subscribe: () => () => {},
  }),
}));

vi.mock("@/hooks/use-warm-set", () => ({
  useWarmSet: () => ({
    topUp: h.warmSetTopUp,
    inspect: h.warmSetInspect,
    promoteCreatedRecipe: vi.fn(),
  }),
}));

vi.mock("@/lib/connectivity", () => ({
  probeBackendReachable: h.probeBackendReachable,
  setOfflineForced: h.setOfflineForced,
}));

vi.mock("@/lib/outbox", () => {
  return {
    requeueParkedEntries: h.requeueParkedEntries,
    discardAllEntries: h.discardAllEntries,
    outboxStore: {
      forOwner: vi.fn(async () => h.outboxEntries),
      subscribe: vi.fn(() => () => {}),
    },
  };
});

vi.mock("@/lib/query-cache", () => ({
  cacheManager: {
    owner: () => h.owner,
    subscribe: () => () => {},
    resetOfflineCopy: h.resetOfflineCopy,
  },
}));

function renderStatus() {
  return renderHook(() => useOfflineStatus());
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
  h.syncing = false;
  h.probeBackendReachable.mockResolvedValue(true);
  h.warmSetInspect.mockResolvedValue({
    recipes: 2,
    groceries: 3,
    stores: 1,
    plannedThisWeek: 4,
    lastCompletedAt: null,
  });
  h.warmSetTopUp.mockImplementation(async () => {
    return "complete";
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

  it("syncNow delegates convergence to Recovery and refreshes the inventory", async () => {
    h.warmSetInspect.mockResolvedValue({
      recipes: 2,
      groceries: 3,
      stores: 1,
      plannedThisWeek: 4,
      lastCompletedAt: 1234,
    });

    const { result } = renderStatus();

    await act(() => result.current.syncNow());

    expect(h.recover).toHaveBeenCalledTimes(1);
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
    expect(h.recover).not.toHaveBeenCalled();
    expect(result.current.isSyncing).toBe(false);
  });

  it("syncNow recovers after a successful probe while Offline", async () => {
    setConnectivity("offline");

    const { result } = renderStatus();

    await act(() => result.current.syncNow());

    expect(h.recover).toHaveBeenCalledTimes(1);
  });

  it("syncNow is inert under the dev override — the transport is blocked", async () => {
    setConnectivity("offline-forced");

    const { result } = renderStatus();

    await act(() => result.current.syncNow());

    expect(h.probeBackendReachable).not.toHaveBeenCalled();
    expect(h.recover).not.toHaveBeenCalled();
  });

  it("wipeCache clears the read cache, re-warms while Live and re-reads the stamp", async () => {
    h.warmSetInspect.mockResolvedValue({
      recipes: 2,
      groceries: 3,
      stores: 1,
      plannedThisWeek: 4,
      lastCompletedAt: 5678,
    });

    const { result } = renderStatus();

    await act(() => result.current.wipeCache());

    expect(h.resetOfflineCopy).toHaveBeenCalledWith("manual");
    expect(h.warmSetTopUp).toHaveBeenCalled();
    expect(result.current.lastWarmedAt).toBe(5678);
  });

  it("wipeCache while Offline leaves the cache empty without re-warming", async () => {
    setConnectivity("offline");

    const { result } = renderStatus();

    await act(() => result.current.wipeCache());

    expect(h.resetOfflineCopy).toHaveBeenCalledWith("manual");
    expect(h.warmSetTopUp).not.toHaveBeenCalled();
    expect(result.current.lastWarmedAt).toBeNull();
  });

  it("discardAll removes the owner's entries and reconciles the cache", async () => {
    const { result } = renderStatus();

    await act(() => result.current.discardAll());

    expect(h.discardAllEntries).toHaveBeenCalledWith("user-1");
    expect(h.recover).toHaveBeenCalledTimes(1);
  });

  it("retryAll un-parks for the active owner", async () => {
    const { result } = renderStatus();

    await act(() => result.current.retryAll());

    expect(h.requeueParkedEntries).toHaveBeenCalledWith("user-1");
    expect(h.recover).toHaveBeenCalledTimes(1);
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
