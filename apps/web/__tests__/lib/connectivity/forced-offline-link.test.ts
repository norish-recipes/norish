import { isOfflineForced, subscribeOfflineForced } from "@/lib/connectivity/forced-offline";
import { createForcedOfflineLink } from "@/lib/connectivity/forced-offline-link";
import { observable } from "@trpc/server/observable";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

vi.mock("@/lib/connectivity/forced-offline", () => ({
  isOfflineForced: vi.fn(() => false),
  subscribeOfflineForced: vi.fn(() => () => {}),
}));

const mockedIsForced = vi.mocked(isOfflineForced);
const mockedSubscribe = vi.mocked(subscribeOfflineForced);

type FakeOp = { type: "query" | "mutation" | "subscription"; path: string; input: unknown };

function runLink(op: FakeOp, next: () => ReturnType<typeof observable>) {
  const link = createForcedOfflineLink()({} as never);

  return new Promise<{ value?: unknown; error?: unknown; nextCalled: boolean }>((resolve) => {
    let nextCalled = false;
    let settled = false;

    const settle = (result: { value?: unknown; error?: unknown }) => {
      if (!settled) {
        settled = true;
        resolve({ ...result, nextCalled });
      }
    };

    link({
      op,
      next: () => {
        nextCalled = true;

        return next();
      },
    } as never).subscribe({
      next: (value: unknown) => settle({ value }),
      error: (error: unknown) => settle({ error }),
      complete: () => settle({}),
    });

    // Subscriptions must hang pending; give the microtask queue a tick then settle.
    queueMicrotask(() => settle({}));
  });
}

const succeedWith = (value: unknown) => () => observable((observer) => observer.next(value));

afterEach(() => {
  mockedIsForced.mockReset().mockReturnValue(false);
  mockedSubscribe.mockReset().mockReturnValue(() => {});
});

/**
 * Run a subscription op through the link and keep it open, capturing what
 * reaches the observer and whether/when the transport (next) is engaged.
 */
function openSubscription() {
  let listener: (() => void) | undefined;
  const release = vi.fn();

  mockedSubscribe.mockImplementation((fn: () => void) => {
    listener = fn;

    return release;
  });

  const link = createForcedOfflineLink()({} as never);
  const received: unknown[] = [];
  let nextCalled = false;

  const subscription = link({
    op: { type: "subscription", path: "realtime.stream", input: {} },
    next: () => {
      nextCalled = true;

      return observable((observer) => {
        observer.next("live-event");

        return () => {};
      });
    },
  } as never).subscribe({
    next: (value: unknown) => received.push(value),
  });

  return {
    subscription,
    received,
    release,
    fireChange: () => listener?.(),
    wasForwarded: () => nextCalled,
  };
}

describe("createForcedOfflineLink", () => {
  it("passes every op straight through when Offline is not forced", async () => {
    mockedIsForced.mockReturnValue(false);

    const result = await runLink(
      { type: "query", path: "recipes.list", input: {} },
      succeedWith({ ok: true })
    );

    expect(result.nextCalled).toBe(true);
    expect(result.value).toEqual({ ok: true });
  });

  it("short-circuits a query with a backend-unreachable error when forced", async () => {
    mockedIsForced.mockReturnValue(true);

    const result = await runLink(
      { type: "query", path: "recipes.list", input: {} },
      succeedWith({ ok: true })
    );

    expect(result.nextCalled).toBe(false);
    expect(isBackendUnreachableError(result.error)).toBe(true);
  });

  it("short-circuits a mutation with a backend-unreachable error the Outbox can capture", async () => {
    mockedIsForced.mockReturnValue(true);

    const result = await runLink(
      { type: "mutation", path: "groceries.create", input: { id: "g1" } },
      succeedWith({ ok: true })
    );

    expect(result.nextCalled).toBe(false);
    expect(isBackendUnreachableError(result.error)).toBe(true);
  });

  it("leaves a subscription pending and never engages the transport when forced", async () => {
    mockedIsForced.mockReturnValue(true);

    const result = await runLink(
      { type: "subscription", path: "realtime.stream", input: {} },
      succeedWith({ ok: true })
    );

    // No value, no error — and, decisively, next() (the WS transport) was never called.
    expect(result.value).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(result.nextCalled).toBe(false);
  });

  it("forwards a held subscription to the transport when the override clears", () => {
    mockedIsForced.mockReturnValue(true);

    const held = openSubscription();

    expect(held.wasForwarded()).toBe(false);

    // Exit the toggle: flag cleared, then the change notification fires.
    mockedIsForced.mockReturnValue(false);
    held.fireChange();

    // The op reached the real transport and its events flow to the original
    // observer — the subscription "establishes" without a reload (ADR-0007).
    expect(held.wasForwarded()).toBe(true);
    expect(held.received).toEqual(["live-event"]);
    // One-shot: the change listener released itself on forwarding.
    expect(held.release).toHaveBeenCalled();

    held.subscription.unsubscribe();
  });

  it("keeps holding when a change notification fires but the flag is still set", () => {
    mockedIsForced.mockReturnValue(true);

    const held = openSubscription();

    // e.g. a cross-tab write that left the flag on.
    held.fireChange();

    expect(held.wasForwarded()).toBe(false);
    expect(held.received).toEqual([]);

    held.subscription.unsubscribe();
  });

  it("stops listening when the subscriber goes away before the override clears", () => {
    mockedIsForced.mockReturnValue(true);

    const held = openSubscription();

    held.subscription.unsubscribe();

    expect(held.release).toHaveBeenCalled();
    expect(held.wasForwarded()).toBe(false);
  });
});
