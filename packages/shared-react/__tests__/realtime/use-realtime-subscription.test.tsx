/**
 * The client subscription idiom, driven through the real `useSubscription`
 * with a fake procedure whose `subscribe` is recorded: what reaches a handler,
 * what each fresh subscription rereads once live, and what a reset asks for.
 */

import React, { act } from "react";
import {
  InfiniteQueryObserver,
  MutationObserver,
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
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
  rereadOnceWritesSettle,
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

  describe("a read in flight as the reread flushes", () => {
    /** An active read whose every fetch waits for the test, so a reread shows as a second call. */
    function observe(queryKey: unknown[]) {
      const answers: Array<{ resolve: (value: string[]) => void; reject: (err: Error) => void }> =
        [];
      const queryFn = vi.fn(
        () => new Promise<string[]>((resolve, reject) => answers.push({ resolve, reject }))
      );
      const unsubscribe = new QueryObserver(queryClient, {
        queryKey,
        queryFn,
      }).subscribe(() => undefined);

      observers.push(unsubscribe);

      return { queryFn, answers };
    }

    const observers: Array<() => void> = [];

    afterEach(() => {
      for (const unsubscribe of observers.splice(0)) unsubscribe();
    });

    it("rereads a first fetch that was in flight once it lands", async () => {
      const read = observe(GROCERIES);

      render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });
      markLive(current().observer);
      expect(read.queryFn).toHaveBeenCalledTimes(1);

      // That fetch may predate go-live, and its success would clear an invalidation made now.
      await act(async () => read.answers[0]!.resolve(["before"]));

      expect(read.queryFn).toHaveBeenCalledTimes(2);
    });

    it("rereads a read in flight when asked, once it lands", async () => {
      const read = observe(GROCERIES);

      act(() => rereadOnceWritesSettle(queryClient, (query) => query.queryKey === GROCERIES));
      await act(async () => read.answers[0]!.resolve(["before"]));

      expect(read.queryFn).toHaveBeenCalledTimes(2);
    });

    it("holds no other read's reread behind a fetch that has yet to settle", async () => {
      // A fetch that pauses offline never settles until the device is back online.
      const hung = observe(STORES);
      const idle = observe(GROCERIES);

      await act(async () => idle.answers[0]!.resolve(["g"]));

      render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES, STORES] });
      markLive(current().observer);

      expect(hung.queryFn).toHaveBeenCalledTimes(1);
      expect(idle.queryFn).toHaveBeenCalledTimes(2);
    });

    describe("a write that cancels the reread", () => {
      /** A write as shared-react's mutations make one: cancel the read, then write over it. */
      async function write(queryKey: unknown[], optimistic: unknown = ["optimistic"]) {
        const settle: Array<(failed?: Error) => void> = [];
        let sent = () => undefined as void;
        const running = new Promise<void>((resolve) => (sent = resolve));
        const observer = new MutationObserver(queryClient, {
          mutationFn: () => {
            sent();

            return new Promise<void>((resolve, reject) =>
              settle.push((failed) => (failed ? reject(failed) : resolve()))
            );
          },
          onMutate: async () => {
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData(queryKey, optimistic);
          },
        });

        void observer.mutate().catch(() => undefined);
        // Pending from here, its optimistic write made.
        await act(async () => running);

        return { settle: (failed?: Error) => act(async () => settle[0]!(failed)) };
      }

      /** A read that has answered, mounted and live, with its reread in flight. */
      async function liveWithRereadInFlight() {
        const read = observe(GROCERIES);

        await act(async () => read.answers[0]!.resolve(["before"]));
        render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });
        markLive(current().observer);
        expect(read.queryFn).toHaveBeenCalledTimes(2);

        return read;
      }

      /** Listeners on the client's caches, so a test can see what the reread left behind. */
      function listeners() {
        const count = (subscribable: object) =>
          (subscribable as { listeners: Set<unknown> }).listeners.size;

        return count(queryClient.getQueryCache()) + count(queryClient.getMutationCache());
      }

      it("rereads once the write settles, and not while it is pending", async () => {
        const read = await liveWithRereadInFlight();
        const { settle } = await write(GROCERIES);

        // The cancel reverted the reread; the write's own value shows meanwhile.
        expect(queryClient.getQueryData(GROCERIES)).toEqual(["optimistic"]);
        expect(read.queryFn).toHaveBeenCalledTimes(2);

        await settle();
        expect(read.queryFn).toHaveBeenCalledTimes(3);
      });

      it("holds the reread of a read in flight at the flush until a write that cancels it settles", async () => {
        const read = observe(GROCERIES);

        await act(async () => read.answers[0]!.resolve(["before"]));
        // A refetch from before go-live, still in flight as the window flushes.
        void queryClient.refetchQueries({ queryKey: GROCERIES });
        render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });
        markLive(current().observer);
        expect(read.queryFn).toHaveBeenCalledTimes(2);

        const { settle } = await write(GROCERIES);

        expect(read.queryFn).toHaveBeenCalledTimes(2);
        expect(queryClient.getQueryData(GROCERIES)).toEqual(["optimistic"]);
        await settle();
        expect(read.queryFn).toHaveBeenCalledTimes(3);
      });

      it("rereads an infinite read from its first page when a next-page fetch is running", async () => {
        const RECIPES = [["recipes", "list"], { type: "infinite" }];
        const pageParams: number[] = [];
        const answers: Array<(page: string) => void> = [];
        const unsubscribe = new InfiniteQueryObserver(queryClient, {
          queryKey: RECIPES,
          queryFn: ({ pageParam }: { pageParam: number }) => {
            pageParams.push(pageParam);

            return new Promise<string>((resolve) => answers.push(resolve));
          },
          initialPageParam: 0,
          getNextPageParam: (_last: string, pages: string[]) => pages.length,
        }).subscribe(() => undefined);

        observers.push(unsubscribe);
        await act(async () => answers[0]!("p0"));
        render({ onEvent: vi.fn(), liveQueryKeys: [RECIPES] });
        markLive(current().observer);
        expect(pageParams).toEqual([0, 0]);

        const { settle } = await write(RECIPES, { pages: ["optimistic"], pageParams: [0] });
        const observer = queryClient.getQueryCache().find({ queryKey: RECIPES })!.observers[0]!;

        // A scroll while the write is pending: its fetch must not stand in for the reread.
        void (observer as InfiniteQueryObserver<unknown>).fetchNextPage();
        expect(pageParams).toEqual([0, 0, 1]);
        await settle();
        expect(pageParams).toEqual([0, 0, 1, 0]);
      });

      it("retries a reread a realtime patch landed on before a write cancelled it", async () => {
        const read = await liveWithRereadInFlight();

        act(() => queryClient.setQueryData(GROCERIES, ["patched"]));
        await (await write(GROCERIES)).settle();

        expect(read.queryFn).toHaveBeenCalledTimes(3);
      });

      it("retries when a write cancels the fetch an event's invalidation replaced the reread with", async () => {
        const read = await liveWithRereadInFlight();

        act(() => void queryClient.invalidateQueries({ queryKey: GROCERIES }));
        expect(read.queryFn).toHaveBeenCalledTimes(3);
        await (await write(GROCERIES)).settle();

        expect(read.queryFn).toHaveBeenCalledTimes(4);
      });

      it("rereads nothing for a subscription that goes live while a write is pending until it settles", async () => {
        const read = observe(GROCERIES);

        await act(async () => read.answers[0]!.resolve(["before"]));
        const { settle } = await write(GROCERIES);

        render({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] });
        markLive(current().observer);
        expect(read.queryFn).toHaveBeenCalledTimes(1);
        expect(queryClient.getQueryData(GROCERIES)).toEqual(["optimistic"]);

        await settle();
        expect(read.queryFn).toHaveBeenCalledTimes(2);
      });

      it("waits again when a second write cancels the retried reread", async () => {
        const read = await liveWithRereadInFlight();

        await (await write(GROCERIES)).settle();
        expect(read.queryFn).toHaveBeenCalledTimes(3);

        const second = await write(GROCERIES);

        expect(read.queryFn).toHaveBeenCalledTimes(3);
        await second.settle(new Error("rejected"));
        expect(read.queryFn).toHaveBeenCalledTimes(4);
      });

      it("does not retry a reread that failed", async () => {
        const read = await liveWithRereadInFlight();

        await act(async () => read.answers[1]!.reject(new Error("offline")));
        await (await write(GROCERIES)).settle();

        expect(read.queryFn).toHaveBeenCalledTimes(2);
      });

      it("leaves nothing subscribed once the retry lands, or once the client is cleared", async () => {
        const before = listeners();
        const read = await liveWithRereadInFlight();

        await (await write(GROCERIES)).settle();
        await act(async () => read.answers[2]!.resolve(["after"]));
        expect(listeners()).toBe(before);

        // Another fresh subscription's reread, cancelled by a write that never settles.
        markLive(mountCopy({ onEvent: vi.fn(), liveQueryKeys: [GROCERIES] }).observer);
        expect(read.queryFn).toHaveBeenCalledTimes(4);
        await write(GROCERIES);
        expect(listeners()).toBeGreaterThan(before);

        act(() => queryClient.clear());
        await act(async () => undefined);
        expect(listeners()).toBe(before);
        expect(read.queryFn).toHaveBeenCalledTimes(4);
      });
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
