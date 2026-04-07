import { TRPCClientError } from "@trpc/client";
import { observable, observableToPromise } from "@trpc/server/observable";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOutboxLink, startOutboxProcessor } from "../../src/lib/outbox/outbox-link";
import * as outboxStore from "../../src/lib/outbox/outbox-store";

const { mockStorage, mockProcessQueue, reachabilitySnapshot, reachabilityListeners } = vi.hoisted(
  () => ({
    mockStorage: new Map<string, string>(),
    mockProcessQueue: vi.fn().mockResolvedValue(undefined),
    reachabilitySnapshot: {
      appOnline: false,
      mode: "offline",
      runtimeState: "initializing",
    },
    reachabilityListeners: new Set<
      (snapshot: { appOnline: boolean; mode: string; runtimeState: string }) => void
    >(),
  })
);

vi.mock("@/lib/storage/outbox-mmkv", () => ({
  outboxStorage: {
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
    delete: (key: string) => mockStorage.delete(key),
  },
}));

vi.mock("@/lib/network/reachability-store", () => ({
  getReachabilitySnapshot: () => reachabilitySnapshot,
  subscribeToReachabilitySnapshot: (listener: (snapshot: typeof reachabilitySnapshot) => void) => {
    reachabilityListeners.add(listener);

    return () => {
      reachabilityListeners.delete(listener);
    };
  },
}));

vi.mock("../../src/lib/outbox/outbox-replay", async () => {
  const actual = await vi.importActual("../../src/lib/outbox/outbox-replay");

  return {
    ...actual,
    processQueue: mockProcessQueue,
  };
});

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("outbox-link", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockProcessQueue.mockClear();
    reachabilityListeners.clear();
    reachabilitySnapshot.appOnline = false;
    reachabilitySnapshot.mode = "offline";
    reachabilitySnapshot.runtimeState = "initializing";
  });

  function updateReachability(next: Partial<typeof reachabilitySnapshot>) {
    Object.assign(reachabilitySnapshot, next);

    for (const listener of reachabilityListeners) {
      listener(reachabilitySnapshot);
    }
  }

  it("persists replay metadata from the failed mutation context", async () => {
    const link = createOutboxLink()({});
    const next = vi.fn(() =>
      observable((observer) => {
        observer.error(
          new TRPCClientError("fetch failed", {
            cause: new TypeError("fetch failed"),
          })
        );
      })
    );

    await expect(
      observableToPromise(
        link({
          op: {
            id: 1,
            type: "mutation",
            path: "recipes.update",
            input: { id: "recipe-1" },
            context: {
              operationId: "op-123",
              headers: {
                "x-operation-id": "op-123",
                "x-client-version": "ios-test",
              },
            },
            signal: null,
          },
          next,
        })
      )
    ).rejects.toBeInstanceOf(TRPCClientError);

    expect(next).toHaveBeenCalledOnce();
    expect(outboxStore.loadAll()).toEqual([
      expect.objectContaining({
        path: "recipes.update",
        request: {
          operationId: "op-123",
          headers: {
            "x-operation-id": "op-123",
            "x-client-version": "ios-test",
          },
        },
      }),
    ]);
  });

  it("does not enqueue mutations for domain-level server errors", async () => {
    const link = createOutboxLink()({});
    const next = vi.fn(() =>
      observable((observer) => {
        const error = new TRPCClientError("Unauthorized", {
          result: {
            error: {
              json: {
                code: -32001,
                message: "UNAUTHORIZED",
                data: { httpStatus: 401, code: "UNAUTHORIZED" },
              },
            },
          },
        } as never);

        Object.defineProperty(error, "data", {
          value: { httpStatus: 401, code: "UNAUTHORIZED" },
          configurable: true,
        });

        observer.error(error);
      })
    );

    await expect(
      observableToPromise(
        link({
          op: {
            id: 2,
            type: "mutation",
            path: "recipes.update",
            input: { id: "recipe-1" },
            context: {},
            signal: null,
          },
          next,
        })
      )
    ).rejects.toBeInstanceOf(TRPCClientError);

    expect(next).toHaveBeenCalledOnce();
    expect(outboxStore.loadAll()).toEqual([]);
  });

  it("does not re-enqueue replayed mutations when they fail again", async () => {
    const link = createOutboxLink()({});
    const next = vi.fn(() =>
      observable((observer) => {
        observer.error(
          new TRPCClientError("fetch failed", {
            cause: new TypeError("fetch failed"),
          })
        );
      })
    );

    await expect(
      observableToPromise(
        link({
          op: {
            id: 3,
            type: "mutation",
            path: "recipes.update",
            input: { id: "recipe-1" },
            context: {
              headers: {
                "x-replay-origin": "mobile-outbox",
              },
              skipOutboxCapture: true,
            },
            signal: null,
          },
          next,
        })
      )
    ).rejects.toBeInstanceOf(TRPCClientError);

    expect(outboxStore.loadAll()).toEqual([]);
  });

  it("starts replay immediately when the backend is already reachable", () => {
    reachabilitySnapshot.appOnline = true;
    reachabilitySnapshot.runtimeState = "ready";

    const unsubscribe = startOutboxProcessor();

    expect(mockProcessQueue).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("triggers replay when reachability transitions to ready and online", () => {
    reachabilitySnapshot.appOnline = false;
    reachabilitySnapshot.runtimeState = "ready";
    reachabilitySnapshot.mode = "backend-unreachable";

    const unsubscribe = startOutboxProcessor();

    expect(mockProcessQueue).not.toHaveBeenCalled();

    updateReachability({ appOnline: true, mode: "online" });

    expect(mockProcessQueue).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("triggers replay when runtime state becomes ready while already online", () => {
    reachabilitySnapshot.appOnline = true;
    reachabilitySnapshot.mode = "online";
    reachabilitySnapshot.runtimeState = "initializing";

    const unsubscribe = startOutboxProcessor();

    expect(mockProcessQueue).not.toHaveBeenCalled();

    updateReachability({ runtimeState: "ready" });

    expect(mockProcessQueue).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
