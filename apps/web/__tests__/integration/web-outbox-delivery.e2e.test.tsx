import type { AnyTRPCRouter } from "@trpc/server";
import { useEffect, useRef } from "react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { indexedDB } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { TrpcLogger } from "@norish/shared-react/providers";
import { WebOutboxRepository } from "@norish/shared-react/outbox";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { isQueuedDeliveryError } from "@norish/shared/lib/queued-delivery";

import { WebConnectivityRuntime } from "../../lib/connectivity/runtime";
import { createWebTransportFetch } from "../../lib/connectivity/transport";

const DATABASE_NAME = "norish-web-mutation-delivery";
const SCOPE = { backendOrigin: "https://norish.test", userId: "user-1" };
const GROCERY = { id: "grocery-reload", name: "Milk" };

type Grocery = typeof GROCERY;
type TestState = {
  authenticated: boolean;
  reachable: boolean;
  effectCount: number;
  receivedOperationIds: string[];
  effectCountsByOperationId: Map<string, number>;
  committedOperationIds: Set<string>;
  dropResponseFor: string | null;
  serverReadCount: number;
  serverGroceries: Grocery[];
};
type TestClient = {
  groceries: {
    create: {
      mutate: (input: Grocery, options?: { context?: Record<string, unknown> }) => Promise<unknown>;
    };
  };
};

beforeAll(() => {
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
});

afterEach(async () => {
  vi.unstubAllGlobals();

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

function getOperationId(init?: RequestInit): string | null {
  return new Headers(init?.headers).get("x-operation-id");
}

function getMutationInput(init?: RequestInit): Grocery | null {
  if (typeof init?.body !== "string") return null;

  const body = JSON.parse(init.body) as { json?: unknown };
  const input = body.json;

  if (!input || typeof input !== "object") return null;

  const candidate = input as Partial<Grocery>;

  return typeof candidate.id === "string" && typeof candidate.name === "string"
    ? { id: candidate.id, name: candidate.name }
    : null;
}

function installFakeBackend(state: TestState) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!state.reachable) {
        throw new TypeError("Failed to fetch");
      }

      const operationId = getOperationId(init);
      const mutationInput = getMutationInput(init);

      if (operationId) {
        state.receivedOperationIds.push(operationId);

        if (!state.committedOperationIds.has(operationId)) {
          state.committedOperationIds.add(operationId);
          state.effectCount += 1;
          state.effectCountsByOperationId.set(
            operationId,
            (state.effectCountsByOperationId.get(operationId) ?? 0) + 1
          );

          if (mutationInput) {
            state.serverGroceries = [mutationInput];
          }
        }
      }

      if (operationId === state.dropResponseFor) {
        state.dropResponseFor = null;
        throw new TypeError("Failed to fetch");
      }

      return new Response(
        JSON.stringify({
          result: {
            data: {
              json: { success: true, id: mutationInput?.id ?? GROCERY.id },
            },
          },
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    })
  );
}

function createTestBundle(
  state: TestState,
  queryClient: QueryClient,
  options: { transportFetch?: typeof fetch; getReplayUserId?: () => Promise<string | null> } = {}
) {
  const logger: TrpcLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  return createTRPCProviderBundle<AnyTRPCRouter>({
    logger,
    getQueryClient: () => queryClient,
    getBaseUrl: () => SCOPE.backendOrigin,
    getWsUrl: () => "ws://norish.test/trpc",
    transportFetch: options.transportFetch,
    wsLazyEnabled: true,
    enableLoggerLink: false,
    webOutbox: {
      getCaptureUserId: async () => (state.authenticated ? SCOPE.userId : null),
      getReplayUserId:
        options.getReplayUserId ?? (async () => (state.authenticated ? SCOPE.userId : null)),
      getBackendOrigin: () => SCOPE.backendOrigin,
    },
  });
}

function createDeliveryHarness(useClient: () => object | null) {
  return function DeliveryHarness({
    capture,
    getServerGroceries,
  }: {
    capture: boolean;
    getServerGroceries: () => Grocery[];
  }) {
    const queryClient = useQueryClient();
    const client = useClient() as TestClient;
    const captureStartedRef = useRef(false);
    const groceriesQuery = useQuery({
      queryKey: ["groceries"],
      queryFn: async () => getServerGroceries(),
      initialData: [] as Grocery[],
      staleTime: 0,
    });
    const mutation = useMutation({
      mutationFn: (input: Grocery) => client.groceries.create.mutate(input),
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: ["groceries"] });
        queryClient.setQueryData<Grocery[]>(["groceries"], [input]);
      },
      onError: (error) => {
        if (!isQueuedDeliveryError(error)) {
          queryClient.setQueryData<Grocery[]>(["groceries"], []);
        }
      },
    });

    useEffect(() => {
      if (capture && !captureStartedRef.current) {
        captureStartedRef.current = true;
        mutation.mutate(GROCERY);
      }
    }, [capture, mutation.mutate]);

    return (
      <output data-testid="delivery-state">
        {JSON.stringify({
          groceries: groceriesQuery.data,
          mutationStatus: mutation.status,
        })}
      </output>
    );
  };
}

describe("web outbox delivery through the provider", () => {
  it("keeps the outbox before simulated transport so optimistic mutations are captured", async () => {
    const state: TestState = {
      authenticated: true,
      reachable: true,
      effectCount: 0,
      receivedOperationIds: [],
      effectCountsByOperationId: new Map(),
      committedOperationIds: new Set(),
      dropResponseFor: null,
      serverReadCount: 0,
      serverGroceries: [],
    };
    installFakeBackend(state);
    const runtime = new WebConnectivityRuntime("development", window.localStorage);

    await runtime.setSimulatedBackendUnavailable(true);
    const queryClient = new QueryClient();
    const bundle = createTestBundle(state, queryClient, {
      transportFetch: createWebTransportFetch(runtime),
      getReplayUserId: async () => null,
    });
    const Harness = createDeliveryHarness(bundle.useTRPCClient);
    const rendered = render(
      <bundle.TRPCProviderWrapper>
        <Harness capture getServerGroceries={() => state.serverGroceries} />
      </bundle.TRPCProviderWrapper>
    );

    await waitFor(async () => {
      expect(await new WebOutboxRepository().listPending(SCOPE)).toHaveLength(1);
    });
    expect(queryClient.getQueryData<Grocery[]>(["groceries"])).toEqual([GROCERY]);
    expect(state.effectCount).toBe(0);
    expect(runtime.getSnapshot().state).toBe("backend-unreachable");

    rendered.unmount();
    window.localStorage.clear();
  });

  it("keeps an optimistic mutation across reload and reconnects it once", async () => {
    const state: TestState = {
      authenticated: true,
      reachable: false,
      effectCount: 0,
      receivedOperationIds: [],
      effectCountsByOperationId: new Map(),
      committedOperationIds: new Set(),
      dropResponseFor: null,
      serverReadCount: 0,
      serverGroceries: [],
    };
    installFakeBackend(state);

    const firstQueryClient = new QueryClient();
    const firstBundle = createTestBundle(state, firstQueryClient);
    const FirstDeliveryHarness = createDeliveryHarness(firstBundle.useTRPCClient);
    const first = render(
      <firstBundle.TRPCProviderWrapper>
        <FirstDeliveryHarness
          capture={false}
          getServerGroceries={() => {
            state.serverReadCount += 1;
            return state.serverGroceries;
          }}
        />
      </firstBundle.TRPCProviderWrapper>
    );

    await waitFor(() => expect(state.serverReadCount).toBeGreaterThan(0));
    await waitFor(() => expect(firstQueryClient.isFetching({ queryKey: ["groceries"] })).toBe(0));

    first.rerender(
      <firstBundle.TRPCProviderWrapper>
        <FirstDeliveryHarness
          capture
          getServerGroceries={() => {
            state.serverReadCount += 1;
            return state.serverGroceries;
          }}
        />
      </firstBundle.TRPCProviderWrapper>
    );

    await waitFor(async () => {
      expect(firstQueryClient.getQueryData<Grocery[]>(["groceries"])).toEqual([GROCERY]);
      const entries = await new WebOutboxRepository().listPending(SCOPE);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.operationId).toBeTruthy();
    });

    const [entry] = await new WebOutboxRepository().listPending(SCOPE);
    expect(entry).toBeDefined();
    const operationId = entry!.operationId;

    first.unmount();
    state.authenticated = false;

    const secondQueryClient = new QueryClient();
    const secondBundle = createTestBundle(state, secondQueryClient);
    const SecondDeliveryHarness = createDeliveryHarness(secondBundle.useTRPCClient);
    const second = render(
      <secondBundle.TRPCProviderWrapper>
        <SecondDeliveryHarness capture={false} getServerGroceries={() => state.serverGroceries} />
      </secondBundle.TRPCProviderWrapper>
    );

    await waitFor(async () => {
      expect(await new WebOutboxRepository().listPending(SCOPE)).toHaveLength(1);
    });

    state.authenticated = true;
    state.reachable = true;

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(async () => {
      const entries = await new WebOutboxRepository().list(SCOPE);
      expect(entries.find((candidate) => candidate.operationId === operationId)).toBeUndefined();
    });

    expect(state.effectCount).toBe(1);
    expect(state.receivedOperationIds).toEqual([operationId]);
    await waitFor(() => {
      expect(secondQueryClient.getQueryData<Grocery[]>(["groceries"])).toEqual([GROCERY]);
    });

    const lostResponseOperationId = "operation-lost-response-e2e";
    const lostResponseEntry = await new WebOutboxRepository().enqueue({
      ...SCOPE,
      operationId: lostResponseOperationId,
      path: "groceries.create",
      input: { id: "grocery-lost-response", name: "Eggs" },
    });
    state.dropResponseFor = lostResponseOperationId;

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(async () => {
      expect(
        (await new WebOutboxRepository().list(SCOPE)).find(
          (candidate) => candidate.id === lostResponseEntry.id
        )?.state
      ).toBe("retrying");
    });

    await new WebOutboxRepository().update(lostResponseEntry.id, { nextRetryAt: Date.now() });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(async () => {
      expect(
        (await new WebOutboxRepository().list(SCOPE)).find(
          (candidate) => candidate.id === lostResponseEntry.id
        )
      ).toBeUndefined();
    });

    expect(state.effectCountsByOperationId.get(lostResponseOperationId)).toBe(1);

    second.unmount();
  });
});
