/**
 * The client subscription idiom, driven through the real `useSubscription`
 * with a fake procedure whose `subscribe` is recorded: what reaches a handler,
 * what each fresh subscription rereads once live, and what a reset asks for.
 */

import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import {
  CURSOR_MARK,
  ENVELOPE_VERSION,
  REALTIME_LAGGED,
} from "@norish/shared/contracts/realtime/envelope";

import type { RealtimeSubscriptionHandlers } from "../../src/realtime/use-realtime-subscription";
import {
  isRealtimeLagged,
  useRealtimeSubscription,
} from "../../src/realtime/use-realtime-subscription";

type Observer = {
  onStarted?: () => void;
  onData?: (data: unknown) => void;
  onError?: (err: unknown) => void;
};

/** One `subscribe` per subscription the hook opens, with the input it was given. */
const subscriptions: Array<{
  input: unknown;
  observer: Observer;
  unsubscribe: ReturnType<typeof vi.fn>;
}> = [];

/** The options the hook handed `subscriptionOptions`, one per call. */
const optionCalls: Array<Record<string, unknown>> = [];

function fakeProcedure(path: string) {
  return {
    subscriptionOptions(input: undefined, opts: Record<string, unknown>) {
      optionCalls.push(opts);

      return {
        ...opts,
        queryKey: [[path, "onEvent"], { type: "any" }],
        // As @trpc/tanstack-react-query resolves it: the key's presence decides,
        // not its value, so `{ enabled: undefined }` is a disabled subscription.
        enabled: "enabled" in opts ? !!opts.enabled : true,
        subscribe(observer: Observer) {
          const unsubscribe = vi.fn();

          subscriptions.push({ input, observer, unsubscribe });
          observer.onStarted?.();

          return { unsubscribe };
        },
      };
    },
  };
}

const procedure = fakeProcedure("fake");

function envelope(payload: unknown): RealtimeEventEnvelope {
  return {
    meta: {
      version: ENVELOPE_VERSION,
      eventId: "1700000000000-0",
      eventName: "created",
      namespace: "grocery",
      scope: "household",
      channel: "norish:grocery:household:hh-1:created",
      occurredAt: "2026-09-18T00:00:00.000Z",
    },
    payload,
  };
}

function tracked(item: unknown) {
  return { id: "1.abcdef01.1700000000000-0", data: item };
}

function lagged() {
  return new TRPCClientError(REALTIME_LAGGED);
}

let root: ReturnType<typeof createRoot>;
let roots: Array<ReturnType<typeof createRoot>>;
let queryClient: QueryClient;

function newRoot() {
  const container = document.createElement("div");
  const created = createRoot(container);

  document.body.appendChild(container);
  roots.push(created);

  return created;
}

function render(
  handlers: RealtimeSubscriptionHandlers<{ n: number }>,
  strict = false,
  into = root,
  subscribedTo = procedure
) {
  function Probe() {
    useRealtimeSubscription<{ n: number }>(subscribedTo, handlers);

    return null;
  }

  const tree = (
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>
  );

  act(() => {
    into.render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
  });
}

/** Another component holding the same subscription, in its own root so it unmounts alone. */
function mountCopy(
  handlers: RealtimeSubscriptionHandlers<{ n: number }>,
  subscribedTo = procedure
) {
  const own = newRoot();

  render(handlers, false, own, subscribedTo);

  return { observer: current().observer, unmount: () => act(() => own.unmount()) };
}

/** The server's Cursor Mark, then the window it opens. */
function markLive(observer: Observer) {
  act(() => {
    observer.onData?.(tracked(CURSOR_MARK));
  });
  act(() => {
    vi.runOnlyPendingTimers();
  });
}

const GROCERIES = [["groceries", "list"], { type: "query" }];
const STORES = [["stores", "list"], { type: "query" }];

/** Cached reads, so a reread shows as their invalidation. */
function seed(...queryKeys: unknown[][]) {
  for (const queryKey of queryKeys) queryClient.setQueryData(queryKey, []);
}

function isReread(queryKey: unknown[]) {
  return queryClient.getQueryState(queryKey)?.isInvalidated === true;
}

/** Marks the cached reads current again, so the next reread shows. */
function settle(...queryKeys: unknown[][]) {
  for (const queryKey of queryKeys) queryClient.setQueryData(queryKey, []);
}

function current() {
  const latest = subscriptions.at(-1);

  if (!latest) throw new Error("No subscription open");

  return latest;
}

beforeEach(() => {
  vi.useFakeTimers();
  subscriptions.length = 0;
  optionCalls.length = 0;
  // No garbage collection: the window's timers run every pending timer, the cache's too.
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  roots = [];
  root = newRoot();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  for (const created of roots) act(() => created.unmount());
  document.body.replaceChildren();
  queryClient.clear();
});

describe("isRealtimeLagged", () => {
  it("is the tRPC client error whose message is REALTIME_LAGGED and nothing else", () => {
    expect(isRealtimeLagged(lagged())).toBe(true);
    expect(isRealtimeLagged(new TRPCClientError("UNAUTHORIZED"))).toBe(false);
    expect(isRealtimeLagged(new Error(REALTIME_LAGGED))).toBe(false);
    expect(isRealtimeLagged(null)).toBe(false);
  });
});

describe("useRealtimeSubscription", () => {
  it("hands (payload, meta) to onEvent and never a Cursor Mark", () => {
    const onEvent = vi.fn();

    render({ onEvent });

    markLive(current().observer);
    expect(onEvent).not.toHaveBeenCalled();

    const event = envelope({ n: 1 });

    act(() => {
      current().observer.onData?.(tracked(event));
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ n: 1 }, event.meta);
  });

  it("subscribes with no input: lastEventId is the transport's, never the hook's", () => {
    render({ onEvent: vi.fn() });

    expect(subscriptions).toHaveLength(1);
    expect(current().input).toBeUndefined();
  });

  it("rejects anything that is neither a Cursor Mark nor an envelope", () => {
    render({ onEvent: vi.fn() });

    expect(() => current().observer.onData?.(tracked({ groceries: [] }))).toThrow(TypeError);
    expect(() => current().observer.onData?.(envelope({ n: 1 }))).toThrow(TypeError);
  });

  it("on REALTIME_LAGGED resets to a cursor-less subscription, and rereads exactly liveQueryKeys once it is live", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const other = [["pantry", "list"], { type: "query" }];

    seed(GROCERIES, STORES, other);
    render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES, [["stores"]]] });
    markLive(current().observer);
    settle(GROCERIES, STORES);

    const first = current();

    act(() => {
      first.observer.onError?.(lagged());
    });

    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions).toHaveLength(2);
    expect(current()).not.toBe(first);
    expect(current().input).toBeUndefined();
    // An event published before the fresh subscription is live would miss it
    // and an early reread both: the reread waits for its Cursor Mark.
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(invalidate).toHaveBeenCalledTimes(1);

    markLive(current().observer);

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(isReread(GROCERIES)).toBe(true);
    expect(isReread(STORES)).toBe(true);
    expect(isReread(other)).toBe(false);

    // Once: a later Cursor Mark (a reconnect's resume) rereads nothing.
    markLive(current().observer);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it("rereads once on a fresh subscription's first Cursor Mark, not on a resumed reconnect's", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    seed(GROCERIES);
    render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });
    expect(invalidate).not.toHaveBeenCalled();

    markLive(current().observer);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(isReread(GROCERIES)).toBe(true);

    // The link resends the cursor on reconnect, on the same subscribe: Resume closes that gap.
    markLive(current().observer);
    expect(subscriptions).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("rereads once for subscriptions that go live together, whatever keys they share", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    seed(GROCERIES, STORES);

    function Probe() {
      useRealtimeSubscription(fakeProcedure("a"), { onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });
      useRealtimeSubscription(fakeProcedure("b"), { onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });
      useRealtimeSubscription(fakeProcedure("c"), { onEvent: vi.fn(), liveQueryKeys: [STORES] });

      return null;
    }

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      );
    });
    for (const { observer } of subscriptions) {
      act(() => {
        observer.onData?.(tracked(CURSOR_MARK));
      });
    }
    // Not before the window closes: a mark still on its way shares the reread.
    expect(invalidate).not.toHaveBeenCalled();
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(subscriptions).toHaveLength(3);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(isReread(GROCERIES)).toBe(true);
    expect(isReread(STORES)).toBe(true);
  });

  it("gives a mark that arrives after the window flushed its own reread", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    seed(GROCERIES);
    render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] }, false, root, fakeProcedure("a"));
    markLive(current().observer);
    expect(invalidate).toHaveBeenCalledTimes(1);
    settle(GROCERIES);

    mountCopy({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] }, fakeProcedure("b"));
    markLive(current().observer);

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(isReread(GROCERIES)).toBe(true);
  });

  it("rereads once under StrictMode's double mount", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] }, true);

    // StrictMode subscribes, unsubscribes and subscribes again; only the open one is answered.
    const open = subscriptions.filter((s) => s.unsubscribe.mock.calls.length === 0);

    expect(open).toHaveLength(1);
    markLive(open[0]!.observer);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("rereads when a disabled subscription is enabled, and not before", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES], enabled: false });
    expect(subscriptions).toHaveLength(0);

    render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES], enabled: true });
    expect(invalidate).not.toHaveBeenCalled();
    markLive(current().observer);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  describe("a copy of a subscription that is already live", () => {
    const handlers = () => ({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });

    it("rereads nothing a live copy keeps current", () => {
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");

      seed(GROCERIES);
      render(handlers());
      markLive(current().observer);
      settle(GROCERIES);

      mountCopy(handlers());
      markLive(current().observer);

      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(isReread(GROCERIES)).toBe(false);
    });

    it("rereads a key the live copy does not keep, and the same key of another procedure", () => {
      seed(GROCERIES, STORES);
      render(handlers());
      markLive(current().observer);
      settle(GROCERIES);

      mountCopy({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES, STORES] });
      markLive(current().observer);
      expect(isReread(GROCERIES)).toBe(false);
      expect(isReread(STORES)).toBe(true);

      mountCopy(handlers(), fakeProcedure("other"));
      markLive(current().observer);
      expect(isReread(GROCERIES)).toBe(true);
    });

    it("rereads when the first copy was not yet live as this one subscribed", () => {
      seed(GROCERIES);
      render(handlers());
      const first = current().observer;

      const copy = mountCopy(handlers());

      markLive(first);
      settle(GROCERIES);
      markLive(copy.observer);

      expect(isReread(GROCERIES)).toBe(true);
    });

    it("rereads once the live copy has unmounted", () => {
      seed(GROCERIES);
      const first = mountCopy(handlers());

      markLive(first.observer);
      settle(GROCERIES);
      first.unmount();

      mountCopy(handlers());
      markLive(current().observer);

      expect(isReread(GROCERIES)).toBe(true);
    });

    it("rereads after a lag on the copy", () => {
      seed(GROCERIES);
      render(handlers());
      markLive(current().observer);

      const copy = mountCopy(handlers());

      markLive(copy.observer);
      settle(GROCERIES);
      act(() => {
        copy.observer.onError?.(lagged());
      });
      markLive(current().observer);

      expect(isReread(GROCERIES)).toBe(true);
    });

    it("rereads when the live copy lagged", () => {
      seed(GROCERIES);
      render(handlers());
      const first = current().observer;

      markLive(first);
      act(() => {
        first.onError?.(lagged());
      });
      settle(GROCERIES);

      mountCopy(handlers());
      markLive(current().observer);

      expect(isReread(GROCERIES)).toBe(true);
    });
  });

  it("does nothing for an error that is not a lag", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });

    const first = current();

    act(() => {
      first.observer.onError?.(new TRPCClientError("UNAUTHORIZED"));
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(first.unsubscribe).not.toHaveBeenCalled();
    expect(subscriptions).toHaveLength(1);
  });

  it("opens nothing while disabled", () => {
    render({ onEvent: vi.fn(), enabled: false });

    expect(subscriptions).toHaveLength(0);
  });

  it("states no `enabled` to tRPC when the caller stated none, so the subscription opens", () => {
    render({ onEvent: vi.fn() });

    expect(optionCalls).toHaveLength(1);
    expect("enabled" in optionCalls[0]!).toBe(false);
    expect(subscriptions).toHaveLength(1);
  });

  it("passes a stated `enabled: true` through", () => {
    render({ onEvent: vi.fn(), enabled: true });

    expect(optionCalls[0]).toMatchObject({ enabled: true });
    expect(subscriptions).toHaveLength(1);
  });
});
