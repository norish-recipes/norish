/**
 * The client subscription idiom, driven through the real `useSubscription`
 * with a fake procedure whose `subscribe` is recorded: what reaches a handler,
 * what a lag does, and what the subscription after a reset asks for.
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

const procedure = {
  subscriptionOptions(input: undefined, opts: Record<string, unknown>) {
    optionCalls.push(opts);

    return {
      ...opts,
      queryKey: [["fake", "onEvent"], { type: "any" }],
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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let queryClient: QueryClient;

function render(handlers: RealtimeSubscriptionHandlers<{ n: number }>, strict = false) {
  function Probe() {
    useRealtimeSubscription<{ n: number }>(procedure, handlers);

    return null;
  }

  const tree = (
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>
  );

  act(() => {
    root.render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
  });
}

/** The server's Cursor Mark, then the catch-up window it opens. */
function markLive(observer: Observer) {
  act(() => {
    observer.onData?.(tracked(CURSOR_MARK));
  });
  act(() => {
    vi.runOnlyPendingTimers();
  });
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
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
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

  it("on REALTIME_LAGGED resets to a cursor-less subscription, and invalidates exactly catchUpQueryKeys once it is live", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const keys = [[["groceries"]], [["stores", "list"]]];

    render({ onEvent: vi.fn(), catchUpQueryKeys: keys });

    const first = current();

    act(() => {
      first.observer.onError?.(lagged());
    });

    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions).toHaveLength(2);
    expect(current()).not.toBe(first);
    expect(current().input).toBeUndefined();
    // An event published before the fresh subscription is live would miss it
    // and an early refetch both: the refetch waits for its Cursor Mark.
    expect(invalidate).not.toHaveBeenCalled();

    markLive(current().observer);

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenNthCalledWith(1, { queryKey: keys[0] });
    expect(invalidate).toHaveBeenNthCalledWith(2, { queryKey: keys[1] });

    // Once: a later Cursor Mark (a reconnect's resume) is no lag to catch up on.
    markLive(current().observer);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it("catches up once on a fresh subscription's first Cursor Mark, not on a resumed reconnect's", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const keys = [[["groceries"]]];

    render({ onEvent: vi.fn(), catchUpQueryKeys: keys });
    expect(invalidate).not.toHaveBeenCalled();

    markLive(current().observer);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys[0] });

    // The link resends the cursor on reconnect, on the same subscribe: Resume closes that gap.
    markLive(current().observer);
    expect(subscriptions).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("refetches once for subscriptions that go live together and share what they refetch", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onCatchUp = vi.fn();

    function Probe() {
      useRealtimeSubscription(procedure, { onEvent: vi.fn(), catchUpQueryKeys: [[["groceries"]]] });
      useRealtimeSubscription(procedure, { onEvent: vi.fn(), catchUpQueryKeys: [[["groceries"]]] });
      useRealtimeSubscription(procedure, { onEvent: vi.fn(), onCatchUp });
      useRealtimeSubscription(procedure, { onEvent: vi.fn(), onCatchUp });

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
    // Not before the window closes: a mark still on its way shares the refetch.
    expect(invalidate).not.toHaveBeenCalled();
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(subscriptions).toHaveLength(4);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(onCatchUp).toHaveBeenCalledTimes(1);
  });

  it("catches up once under StrictMode's double mount", () => {
    const onCatchUp = vi.fn();

    render({ onEvent: vi.fn(), onCatchUp }, true);

    // StrictMode subscribes, unsubscribes and subscribes again; only the open one is answered.
    const open = subscriptions.filter((s) => s.unsubscribe.mock.calls.length === 0);

    expect(open).toHaveLength(1);
    markLive(open[0]!.observer);
    expect(onCatchUp).toHaveBeenCalledTimes(1);
  });

  it("catches up when a disabled subscription is enabled, and not before", () => {
    const onCatchUp = vi.fn();

    render({ onEvent: vi.fn(), onCatchUp, enabled: false });
    expect(subscriptions).toHaveLength(0);
    expect(onCatchUp).not.toHaveBeenCalled();

    render({ onEvent: vi.fn(), onCatchUp, enabled: true });
    markLive(current().observer);
    expect(onCatchUp).toHaveBeenCalledTimes(1);
  });

  it("prefers onCatchUp over catchUpQueryKeys", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onCatchUp = vi.fn();

    render({ onEvent: vi.fn(), catchUpQueryKeys: [[["groceries"]]], onCatchUp });

    act(() => {
      current().observer.onError?.(lagged());
    });
    markLive(current().observer);

    expect(onCatchUp).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(subscriptions).toHaveLength(2);
  });

  it("does nothing for an error that is not a lag", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    render({ onEvent: vi.fn(), catchUpQueryKeys: [[["groceries"]]] });

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
