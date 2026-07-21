import { isOfflineForced } from "@/lib/connectivity/forced-offline";
import { createForcedOfflineLink } from "@/lib/connectivity/forced-offline-link";
import { observable } from "@trpc/server/observable";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

vi.mock("@/lib/connectivity/forced-offline", () => ({
  isOfflineForced: vi.fn(() => false),
}));

const mockedIsForced = vi.mocked(isOfflineForced);

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

afterEach(() => mockedIsForced.mockReset().mockReturnValue(false));

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
});
