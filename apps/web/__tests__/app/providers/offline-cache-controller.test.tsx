import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { OfflineCacheController } from "@/app/providers/offline-cache-controller";

const cache = vi.hoisted(() => {
  const state = {
    owner: null as string | null,
    listeners: new Set<() => void>(),
  };

  return {
    state,
    owner: vi.fn(() => state.owner),
    subscribe: vi.fn((listener: () => void) => {
      state.listeners.add(listener);

      return () => state.listeners.delete(listener);
    }),
    reconcileIdentity: vi.fn<
      (options: { sessionUserId: string | null; isOffline: boolean }) => Promise<void>
    >(() => Promise.resolve()),
    publish(owner: string | null) {
      state.owner = owner;

      for (const listener of state.listeners) listener();
    },
  };
});
const warmSetTopUp = vi.hoisted(() => vi.fn<() => Promise<void>>(() => Promise.resolve()));

const outboxStoreMock = vi.hoisted(() => ({}) as Record<string, never>);
const processQueue = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const runReconnectSequence = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const setReplaySubmit = vi.hoisted(() => vi.fn());
const setReplayOwnerResolver = vi.hoisted(() => vi.fn());
const setReplaySessionGuard = vi.hoisted(() => vi.fn());
const replayOutboxEntry = vi.hoisted(() => vi.fn());

let user: { id: string } | null = null;
let connectivity = { isLive: true, isOffline: false };

vi.mock("@/context/user-context", () => ({ useUserContext: () => ({ user }) }));
vi.mock("@/app/providers/connectivity-provider", () => ({ useConnectivity: () => connectivity }));
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPCClient: () => ({}),
}));
vi.mock("@/lib/query-cache", () => ({
  cacheManager: {
    owner: cache.owner,
    subscribe: cache.subscribe,
    reconcileIdentity: cache.reconcileIdentity,
  },
}));
vi.mock("@/hooks/use-warm-set", () => ({
  useWarmSet: () => ({ topUp: warmSetTopUp, inspect: vi.fn(), promoteCreatedRecipe: vi.fn() }),
}));
vi.mock("@/lib/outbox", () => ({
  outboxStore: outboxStoreMock,
  processQueue,
  runReconnectSequence,
  runIfLeader: (task: () => unknown) => task(),
  setReplaySubmit,
  setReplayOwnerResolver,
  setReplaySessionGuard,
  replayOutboxEntry,
}));

function renderController() {
  const queryClient = new QueryClient();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <OfflineCacheController>
        <div>child</div>
      </OfflineCacheController>
    </QueryClientProvider>
  );

  return { ...result, queryClient };
}

describe("OfflineCacheController", () => {
  beforeEach(() => {
    for (const fn of [
      cache.reconcileIdentity,
      warmSetTopUp,
      processQueue,
      runReconnectSequence,
      setReplaySubmit,
      setReplayOwnerResolver,
    ]) {
      fn.mockClear();
    }
    cache.state.owner = null;
    cache.state.listeners.clear();
    cache.owner.mockClear();
    cache.subscribe.mockClear();
    cache.reconcileIdentity.mockImplementation(async ({ sessionUserId }) => {
      if (sessionUserId) cache.publish(sessionUserId);
    });
    user = null;
    connectivity = { isLive: true, isOffline: false };
  });

  afterEach(() => cleanup());

  it("reconciles the cache owner from the current identity and connectivity", async () => {
    user = { id: "u1" };
    renderController();

    await waitFor(() =>
      expect(cache.reconcileIdentity).toHaveBeenCalledWith({
        sessionUserId: "u1",
        isOffline: false,
      })
    );
  });

  it("hides the outgoing owner's UI until an account switch is isolated", async () => {
    user = { id: "u1" };
    const view = renderController();

    await screen.findByText("child");

    let finishSwitch: (() => void) | undefined;

    cache.reconcileIdentity.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSwitch = () => {
            cache.publish("u2");
            resolve();
          };
        })
    );
    user = { id: "u2" };
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <OfflineCacheController>
          <div>child</div>
        </OfflineCacheController>
      </QueryClientProvider>
    );

    expect(screen.queryByText("child")).not.toBeInTheDocument();

    finishSwitch?.();

    await screen.findByText("child");
  });

  it("registers how the Outbox replays and who owns it", async () => {
    user = { id: "u1" };
    renderController();

    await waitFor(() => expect(setReplaySubmit).toHaveBeenCalled());
    expect(setReplayOwnerResolver).toHaveBeenCalled();
  });

  it("retains other owners' queued mutations dormant (no purge on identity change)", async () => {
    user = { id: "u1" };
    renderController();

    // ADR-0009: a bypassed identity transition keeps the outgoing queue under
    // its owner. The controller never touches the store — the outbox mock has
    // no methods at all, so any store call here would throw — and Replay stays
    // owner-scoped via the registered resolver.
    await waitFor(() => expect(setReplayOwnerResolver).toHaveBeenCalled());

    const resolver = setReplayOwnerResolver.mock.calls.at(-1)?.[0] as () => string | null;

    expect(resolver()).toBe("u1");
  });

  it("runs the Reconnect Sequence once an owner is settled while Live", async () => {
    user = { id: "u1" };
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
    renderController();

    await waitFor(() =>
      expect(cache.reconcileIdentity).toHaveBeenCalledWith({
        sessionUserId: "u1",
        isOffline: true,
      })
    );
    expect(runReconnectSequence).not.toHaveBeenCalled();
  });

  it("does not act before an owner is known (session unresolved)", async () => {
    user = null;
    renderController();

    await waitFor(() =>
      expect(cache.reconcileIdentity).toHaveBeenCalledWith({
        sessionUserId: null,
        isOffline: false,
      })
    );
    expect(runReconnectSequence).not.toHaveBeenCalled();
  });
});
