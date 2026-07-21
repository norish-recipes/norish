import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const resolveCacheOwner = vi.hoisted(() => vi.fn<() => Promise<void>>(() => Promise.resolve()));
const activeCacheOwner = vi.hoisted(() => vi.fn<() => string | null>(() => null));
const warmCache = vi.hoisted(() => vi.fn<() => Promise<void>>(() => Promise.resolve()));

const purgeExcept = vi.hoisted(() => vi.fn<() => Promise<number>>(() => Promise.resolve(0)));
const processQueue = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const runReconnectSequence = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const setReplaySubmit = vi.hoisted(() => vi.fn());
const setReplayOwnerResolver = vi.hoisted(() => vi.fn());
const replayOutboxEntry = vi.hoisted(() => vi.fn());

let user: { id: string } | null = null;
let connectivity = { isLive: true, isOffline: false };

vi.mock("@/context/user-context", () => ({ useUserContext: () => ({ user }) }));
vi.mock("@/app/providers/connectivity-provider", () => ({ useConnectivity: () => connectivity }));
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({}),
  useTRPCClient: () => ({}),
}));
vi.mock("@/lib/query-cache", () => ({ resolveCacheOwner, activeCacheOwner, warmCache }));
vi.mock("@/lib/outbox", () => ({
  outboxStore: { purgeExcept },
  processQueue,
  runReconnectSequence,
  runIfLeader: (task: () => unknown) => task(),
  setReplaySubmit,
  setReplayOwnerResolver,
  replayOutboxEntry,
}));

import { OfflineCacheController } from "@/app/providers/offline-cache-controller";

function renderController() {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <OfflineCacheController>
        <div>child</div>
      </OfflineCacheController>
    </QueryClientProvider>
  );
}

describe("OfflineCacheController", () => {
  beforeEach(() => {
    for (const fn of [
      resolveCacheOwner,
      warmCache,
      purgeExcept,
      processQueue,
      runReconnectSequence,
      setReplaySubmit,
      setReplayOwnerResolver,
    ]) {
      fn.mockClear();
    }
    activeCacheOwner.mockReset().mockReturnValue(null);
    user = null;
    connectivity = { isLive: true, isOffline: false };
  });

  afterEach(() => cleanup());

  it("reconciles the cache owner from the current identity and connectivity", async () => {
    user = { id: "u1" };
    activeCacheOwner.mockReturnValue("u1");

    renderController();

    await waitFor(() =>
      expect(resolveCacheOwner).toHaveBeenCalledWith({ sessionUserId: "u1", isOffline: false })
    );
  });

  it("registers how the Outbox replays and who owns it", async () => {
    user = { id: "u1" };
    activeCacheOwner.mockReturnValue("u1");

    renderController();

    await waitFor(() => expect(setReplaySubmit).toHaveBeenCalled());
    expect(setReplayOwnerResolver).toHaveBeenCalled();
  });

  it("purges a departed user's queued mutations once an owner is settled", async () => {
    user = { id: "u1" };
    activeCacheOwner.mockReturnValue("u1");

    renderController();

    await waitFor(() => expect(purgeExcept).toHaveBeenCalledWith("u1"));
  });

  it("runs the Reconnect Sequence once an owner is settled while Live", async () => {
    user = { id: "u1" };
    activeCacheOwner.mockReturnValue("u1");

    renderController();

    await waitFor(() => expect(runReconnectSequence).toHaveBeenCalledTimes(1));
    // The sequence is given the drain/refetch/warm steps to run in order.
    expect(runReconnectSequence).toHaveBeenCalledWith(
      expect.objectContaining({
        drain: expect.any(Function),
        invalidate: expect.any(Function),
        warm: expect.any(Function),
      })
    );
  });

  it("does not run the Reconnect Sequence while Offline", async () => {
    user = { id: "u1" };
    connectivity = { isLive: false, isOffline: true };
    activeCacheOwner.mockReturnValue("u1");

    renderController();

    await waitFor(() =>
      expect(resolveCacheOwner).toHaveBeenCalledWith({ sessionUserId: "u1", isOffline: true })
    );
    expect(runReconnectSequence).not.toHaveBeenCalled();
  });

  it("does not act before an owner is known (session unresolved)", async () => {
    user = null;
    activeCacheOwner.mockReturnValue(null);

    renderController();

    await waitFor(() =>
      expect(resolveCacheOwner).toHaveBeenCalledWith({ sessionUserId: null, isOffline: false })
    );
    expect(runReconnectSequence).not.toHaveBeenCalled();
    expect(purgeExcept).not.toHaveBeenCalled();
  });
});
