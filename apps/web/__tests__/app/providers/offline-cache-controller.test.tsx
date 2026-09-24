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

const outbox = vi.hoisted(() => {
  const state = { pending: [] as Array<{ seq: number }>, listeners: new Set<() => void>() };

  return {
    state,
    store: {
      forOwner: vi.fn(async () => state.pending),
      subscribe: vi.fn((listener: () => void) => {
        state.listeners.add(listener);

        return () => state.listeners.delete(listener);
      }),
    },
    notify() {
      for (const listener of state.listeners) listener();
    },
  };
});
const replayOutboxEntry = vi.hoisted(() => vi.fn());
const recover = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const isSyncing = vi.hoisted(() => vi.fn(() => false));
const recovery = vi.hoisted(() => ({
  recover,
  isSyncing,
  subscribe: () => () => {},
}));
const liveProbes = vi.hoisted(() => {
  const listeners = new Set<() => void>();

  return {
    listeners,
    probeNow: vi.fn(),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    }),
    fire() {
      for (const listener of listeners) listener();
    },
  };
});
const createRecovery = vi.hoisted(() => vi.fn(() => recovery));

let user: { id: string } | null = null;
let connectivity = { isLive: true, isOffline: false };
let wsStatus: "idle" | "connected" | "disconnected" = "idle";

vi.mock("@/context/user-context", () => ({ useUserContext: () => ({ user }) }));
vi.mock("@/app/providers/connectivity-provider", () => ({
  useConnectivity: () => ({
    ...connectivity,
    probeNow: liveProbes.probeNow,
    subscribeLiveProbes: liveProbes.subscribe,
  }),
}));
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPCClient: () => ({}),
  useConnectionStatus: () => ({ status: wsStatus }),
}));
vi.mock("@/app/providers/recovery-provider", () => ({
  RecoveryProvider: ({ children }: { children: React.ReactNode }) => children,
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
  outboxStore: outbox.store,
  replayOutboxEntry,
}));
vi.mock("@/lib/outbox/recovery", () => ({ createRecovery }));

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
    for (const fn of [cache.reconcileIdentity, warmSetTopUp, createRecovery, recover]) {
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
    wsStatus = "idle";
    outbox.state.pending = [];
    outbox.state.listeners.clear();
    outbox.store.forOwner.mockClear();
    outbox.store.subscribe.mockClear();
    liveProbes.listeners.clear();
    liveProbes.probeNow.mockClear();
    isSyncing.mockReturnValue(false);
  });

  /** Let the controller's first pending-count read settle after mount. */
  async function settled() {
    await waitFor(() => expect(outbox.store.forOwner).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

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

  it("keeps children mounted through a cold start while the owner is still restoring", async () => {
    // The everyday cold start: the session has resolved but the persisted
    // cache has not applied an owner yet. Nothing foreign is live in memory,
    // so hiding here would unmount and remount the whole app (the visible
    // "unloads and loads" flicker).
    cache.reconcileIdentity.mockImplementation(() => new Promise<void>(() => {}));
    user = { id: "u1" };
    renderController();

    expect(screen.getByText("child")).toBeInTheDocument();
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

  it("builds Recovery with the current cache, Outbox and reconciliation adapters", async () => {
    user = { id: "u1" };
    renderController();

    await waitFor(() => expect(createRecovery).toHaveBeenCalled());
    expect(createRecovery).toHaveBeenCalledWith(
      expect.objectContaining({
        store: outbox.store,
        owner: cache.owner,
        submit: expect.any(Function),
        refetchActiveQueries: expect.any(Function),
        topUp: warmSetTopUp,
      })
    );
  });

  it("retains other owners' queued mutations dormant (no purge on identity change)", async () => {
    user = { id: "u1" };
    renderController();

    await waitFor(() => expect(createRecovery).toHaveBeenCalled());
    const resolver = createRecovery.mock.calls.at(-1)?.[0].owner as () => string | null;

    expect(resolver()).toBe("u1");
  });

  it("runs Recovery once an owner is settled while Live", async () => {
    user = { id: "u1" };
    renderController();

    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1));
  });

  it("runs Recovery again when the WebSocket reconnects while already Live", async () => {
    user = { id: "u1" };
    const view = renderController();

    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1));

    const settle = (status: typeof wsStatus) => {
      wsStatus = status;
      view.rerender(
        <QueryClientProvider client={view.queryClient}>
          <OfflineCacheController>
            <div>child</div>
          </OfflineCacheController>
        </QueryClientProvider>
      );
    };

    // The socket has to have been up and dropped for this to be a reconnection;
    // a first connect rides along with startup and has missed nothing.
    settle("connected");
    settle("disconnected");
    settle("connected");

    await waitFor(() => expect(recover).toHaveBeenCalledTimes(2));
    expect(recover).toHaveBeenLastCalledWith("resync");
  });

  it("does not run Recovery again for the socket's first connect", async () => {
    user = { id: "u1" };
    const view = renderController();

    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1));
    expect(recover).toHaveBeenLastCalledWith("startup");

    wsStatus = "connected";
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <OfflineCacheController>
          <div>child</div>
        </OfflineCacheController>
      </QueryClientProvider>
    );

    // Startup already read the live server; connecting the socket adds nothing.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("does not run Recovery while Offline", async () => {
    user = { id: "u1" };
    connectivity = { isLive: false, isOffline: true };
    renderController();

    await waitFor(() =>
      expect(cache.reconcileIdentity).toHaveBeenCalledWith({
        sessionUserId: "u1",
        isOffline: true,
      })
    );
    expect(recover).not.toHaveBeenCalled();
  });

  it("asks the connectivity loop to probe when a mutation is admitted while Live", async () => {
    user = { id: "u1" };
    renderController();
    await settled();

    // The Outbox link admitted a mutation that failed on reachability.
    outbox.state.pending = [{ seq: 1 }];
    outbox.notify();

    await waitFor(() => expect(liveProbes.probeNow).toHaveBeenCalledTimes(1));

    // Replay removing it changes the queue too, but that is no admission.
    outbox.state.pending = [];
    outbox.notify();

    await waitFor(() => expect(outbox.store.forOwner).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(liveProbes.probeNow).toHaveBeenCalledTimes(1);
  });

  it("does not probe for an admission while Offline (the backoff loop already is)", async () => {
    user = { id: "u1" };
    connectivity = { isLive: false, isOffline: true };
    renderController();
    await settled();

    outbox.state.pending = [{ seq: 1 }];
    outbox.notify();

    await waitFor(() => expect(outbox.store.forOwner).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(liveProbes.probeNow).not.toHaveBeenCalled();
  });

  it("drains queued work on a Live verdict", async () => {
    user = { id: "u1" };
    renderController();
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1));

    // The verdict the admission's probe produced: the backend answers, so the
    // queued write goes now rather than at some unrelated reconnect.
    outbox.state.pending = [{ seq: 1 }];
    liveProbes.fire();

    await waitFor(() => expect(recover).toHaveBeenCalledTimes(2));
    expect(recover).toHaveBeenLastCalledWith("queued");
  });

  it("does not treat a Live verdict with nothing queued as a Recovery trigger", async () => {
    user = { id: "u1" };
    renderController();
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1));

    liveProbes.fire();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("leaves queued work to a Recovery that is already running", async () => {
    user = { id: "u1" };
    renderController();
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1));

    outbox.state.pending = [{ seq: 1 }];
    isSyncing.mockReturnValue(true);
    liveProbes.fire();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(recover).toHaveBeenCalledTimes(1);
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
    expect(recover).not.toHaveBeenCalled();
  });
});
