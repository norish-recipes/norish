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
const replayOutboxEntry = vi.hoisted(() => vi.fn());
const recover = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const recovery = vi.hoisted(() => ({
  recover,
  isSyncing: () => false,
  subscribe: () => () => {},
}));
const createRecovery = vi.hoisted(() => vi.fn(() => recovery));

let user: { id: string } | null = null;
let connectivity = { isLive: true, isOffline: false };
let wsStatus: "idle" | "connecting" | "connected" | "disconnected" = "idle";

vi.mock("@/context/user-context", () => ({ useUserContext: () => ({ user }) }));
vi.mock("@/app/providers/connectivity-provider", () => ({ useConnectivity: () => connectivity }));
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
  outboxStore: outboxStoreMock,
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
        store: outboxStoreMock,
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
