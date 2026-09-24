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

function render(handlers: RealtimeSubscriptionHandlers<{ n: number }>) {
  function Probe() {
    useRealtimeSubscription<{ n: number }>(procedure, handlers);

    return null;
  }

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    );
  });
}

function current() {
  const latest = subscriptions.at(-1);

  if (!latest) throw new Error("No subscription open");

  return latest;
}

beforeEach(() => {
  subscriptions.length = 0;
  optionCalls.length = 0;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
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

    act(() => {
      current().observer.onData?.(tracked(CURSOR_MARK));
    });
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

  it("on REALTIME_LAGGED invalidates exactly lagQueryKeys, then resets to a cursor-less subscription", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const keys = [[["groceries"]], [["stores", "list"]]];

    render({ onEvent: vi.fn(), lagQueryKeys: keys });

    const first = current();

    act(() => {
      first.observer.onError?.(lagged());
    });

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenNthCalledWith(1, { queryKey: keys[0] });
    expect(invalidate).toHaveBeenNthCalledWith(2, { queryKey: keys[1] });
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions).toHaveLength(2);
    expect(current()).not.toBe(first);
    expect(current().input).toBeUndefined();
  });

  it("prefers onLag over lagQueryKeys", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onLag = vi.fn();

    render({ onEvent: vi.fn(), lagQueryKeys: [[["groceries"]]], onLag });

    act(() => {
      current().observer.onError?.(lagged());
    });

    expect(onLag).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(subscriptions).toHaveLength(2);
  });

  it("does nothing for an error that is not a lag", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    render({ onEvent: vi.fn(), lagQueryKeys: [[["groceries"]]] });

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
