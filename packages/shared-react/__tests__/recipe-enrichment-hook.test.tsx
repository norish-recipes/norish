import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentStatusDto } from "@norish/shared/lib/recipe-enrichment";

import type { CreateRecipeHooksOptions } from "../src/hooks/recipes/types";
import { createUseRecipeEnrichment } from "../src/hooks/recipes/recipe/use-recipe-enrichment";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return { ...actual, useSubscription: useSubscriptionMock };
});

const STATUS_KEY = ["recipes", "enrichmentStatus", { recipeId: "recipe-1" }];

const statusFetch = vi.fn();
const requestMutate = vi.fn();

function idleStatus(): RecipeEnrichmentStatusDto {
  return {
    recipeId: "recipe-1",
    kinds: [
      { kind: "auto-tagging", state: "idle", origin: null, runId: null, runSequence: null },
      { kind: "allergy-detection", state: "idle", origin: null, runId: null, runSequence: null },
      { kind: "auto-categorization", state: "idle", origin: null, runId: null, runSequence: null },
      { kind: "nutrition-estimation", state: "idle", origin: null, runId: null, runSequence: null },
    ],
  };
}

const useTRPC = (() => ({
  recipes: {
    enrichmentStatus: {
      queryOptions: () => ({ queryKey: STATUS_KEY, queryFn: statusFetch }),
    },
    onEnrichment: {
      subscriptionOptions: (_input: undefined, options: unknown) => options,
    },
    requestEnrichment: {
      mutationOptions: (options: { onError?: (e: unknown, v: unknown) => void }) => ({
        mutationFn: async (input: unknown) => {
          requestMutate(input);
        },
        onError: options?.onError,
      }),
    },
  },
})) as unknown as CreateRecipeHooksOptions["useTRPC"];

/**
 * Deliver a lifecycle event the way the subscription would, then let React Query
 * flush its batched notification so the hook's next render is observable.
 */
async function emitLifecycle(payload: Record<string, unknown>) {
  const options = useSubscriptionMock.mock.calls.at(-1)?.[0] as {
    onData?: (data: unknown) => void;
  };

  await act(async () => {
    options?.onData?.({ payload: { runId: "run-1", runSequence: 1, ...payload } });
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let queryClient: QueryClient;
let latest: ReturnType<ReturnType<typeof createUseRecipeEnrichment>> | null = null;
let manualErrors: string[] = [];

function render(currentUserId: string | null = "user-1") {
  const useRecipeEnrichment = createUseRecipeEnrichment({ useTRPC });

  function Probe() {
    latest = useRecipeEnrichment("recipe-1", currentUserId, {
      onManualError: (kind) => manualErrors.push(kind),
    });

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

beforeEach(() => {
  vi.clearAllMocks();
  manualErrors = [];
  latest = null;
  // Never settles: these tests seed the cache and then assert on realtime
  // transitions, so an in-flight initial fetch must not overwrite them.
  statusFetch.mockReturnValue(new Promise(() => {}));
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

/**
 * The lifecycle state currently in the status cache — what the hook reads on its
 * next render. Asserting the cache keeps these tests independent of when React
 * happens to flush a re-render.
 */
function cachedState(kind: string) {
  const status = queryClient.getQueryData<RecipeEnrichmentStatusDto>(STATUS_KEY);

  return status?.kinds.find((entry) => entry.kind === kind)?.state;
}

describe("useRecipeEnrichment", () => {
  it("reports every kind as idle before any status arrives", () => {
    render();

    expect(latest?.states).toEqual({
      "auto-tagging": "idle",
      "allergy-detection": "idle",
      "auto-categorization": "idle",
      "nutrition-estimation": "idle",
    });
  });

  it("reads the combined status query as the authoritative initial state", async () => {
    queryClient.setQueryData(STATUS_KEY, {
      recipeId: "recipe-1",
      kinds: [
        {
          kind: "auto-tagging",
          state: "processing",
          origin: "automatic",
          runId: "run-a",
          runSequence: 1,
        },
        {
          kind: "allergy-detection",
          state: "failed",
          origin: "automatic",
          runId: "run-b",
          runSequence: 1,
        },
        {
          kind: "auto-categorization",
          state: "succeeded",
          origin: "manual",
          runId: "run-c",
          runSequence: 1,
        },
        {
          kind: "nutrition-estimation",
          state: "idle",
          origin: null,
          runId: null,
          runSequence: null,
        },
      ],
    } satisfies RecipeEnrichmentStatusDto);

    render();

    expect(latest?.states["auto-tagging"]).toBe("processing");
    expect(latest?.states["allergy-detection"]).toBe("failed");
    expect(latest?.states["auto-categorization"]).toBe("succeeded");
    expect(latest?.isBusy("auto-tagging")).toBe(true);
    expect(latest?.isBusy("allergy-detection")).toBe(false);
  });

  it("applies lifecycle events to the cache without refetching", async () => {
    queryClient.setQueryData(STATUS_KEY, idleStatus());
    render();

    const fetchesBefore = statusFetch.mock.calls.length;

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-tagging",
      state: "processing",
      origin: "automatic",
    });

    expect(cachedState("auto-tagging")).toBe("processing");
    expect(statusFetch.mock.calls.length).toBe(fetchesBefore);
  });

  it("does not let an older status response overwrite a newer lifecycle event", async () => {
    let resolveStatus: ((status: RecipeEnrichmentStatusDto) => void) | undefined;

    statusFetch.mockReturnValueOnce(
      new Promise<RecipeEnrichmentStatusDto>((resolve) => {
        resolveStatus = resolve;
      })
    );
    render();

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-tagging",
      state: "processing",
      origin: "automatic",
    });

    await act(async () => {
      resolveStatus?.({
        ...idleStatus(),
        kinds: idleStatus().kinds.map((entry) =>
          entry.kind === "auto-tagging"
            ? {
                ...entry,
                state: "queued" as const,
                origin: "automatic" as const,
                runId: "run-1",
                runSequence: 1,
              }
            : entry
        ),
      });
    });

    expect(cachedState("auto-tagging")).toBe("processing");
  });

  it("lets a status response clear an untouched kind after another kind receives an event", async () => {
    let resolveStatus: ((status: RecipeEnrichmentStatusDto) => void) | undefined;

    statusFetch.mockReturnValueOnce(
      new Promise<RecipeEnrichmentStatusDto>((resolve) => {
        resolveStatus = resolve;
      })
    );
    queryClient.setQueryData(STATUS_KEY, {
      ...idleStatus(),
      kinds: idleStatus().kinds.map((entry) =>
        entry.kind === "allergy-detection"
          ? {
              ...entry,
              state: "failed" as const,
              origin: "automatic" as const,
              runId: "removed-run",
              runSequence: 1,
            }
          : entry
      ),
    });
    render();

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-tagging",
      state: "processing",
      origin: "automatic",
    });

    await act(async () => {
      resolveStatus?.({
        ...idleStatus(),
        kinds: idleStatus().kinds.map((entry) =>
          entry.kind === "auto-tagging"
            ? {
                ...entry,
                state: "queued" as const,
                origin: "automatic" as const,
                runId: "run-1",
                runSequence: 1,
              }
            : entry
        ),
      });
    });

    expect(cachedState("auto-tagging")).toBe("processing");
    expect(cachedState("allergy-detection")).toBe("idle");
  });

  it("ignores lifecycle events for other recipes", async () => {
    queryClient.setQueryData(STATUS_KEY, idleStatus());
    render();

    await emitLifecycle({
      recipeId: "other-recipe",
      kind: "auto-tagging",
      state: "processing",
      origin: "automatic",
    });

    expect(cachedState("auto-tagging")).toBe("idle");
  });

  it("ignores lifecycle payloads outside the shared vocabulary", async () => {
    queryClient.setQueryData(STATUS_KEY, idleStatus());
    render();

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-tagging",
      state: "finished",
      origin: "scheduled",
    });

    expect(cachedState("auto-tagging")).toBe("idle");
  });

  it("does not let a delayed queued event regress an active run", async () => {
    queryClient.setQueryData(STATUS_KEY, {
      ...idleStatus(),
      kinds: idleStatus().kinds.map((entry) =>
        entry.kind === "auto-tagging"
          ? {
              ...entry,
              state: "processing" as const,
              origin: "automatic" as const,
              runId: "run-1",
              runSequence: 1,
            }
          : entry
      ),
    });
    render();

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-tagging",
      state: "queued",
      origin: "automatic",
    });

    expect(cachedState("auto-tagging")).toBe("processing");
  });

  it("accepts queued for a new run after a retained terminal state", async () => {
    queryClient.setQueryData(STATUS_KEY, {
      ...idleStatus(),
      kinds: idleStatus().kinds.map((entry) =>
        entry.kind === "auto-tagging"
          ? {
              ...entry,
              state: "failed" as const,
              origin: "manual" as const,
              runId: "old-run",
              runSequence: 1,
            }
          : entry
      ),
    });
    render();

    await emitLifecycle({
      recipeId: "recipe-1",
      runId: "new-run",
      runSequence: 2,
      kind: "auto-tagging",
      state: "queued",
      origin: "manual",
    });

    expect(cachedState("auto-tagging")).toBe("queued");
  });

  it("ignores a terminal event from an older run after a newer run is queued", async () => {
    queryClient.setQueryData(STATUS_KEY, {
      ...idleStatus(),
      kinds: idleStatus().kinds.map((entry) =>
        entry.kind === "auto-tagging"
          ? {
              ...entry,
              state: "queued" as const,
              origin: "manual" as const,
              runId: "new-run",
              runSequence: 2,
            }
          : entry
      ),
    });
    render();

    await emitLifecycle({
      recipeId: "recipe-1",
      runId: "old-run",
      runSequence: 1,
      kind: "auto-tagging",
      state: "failed",
      origin: "manual",
      requestedByUserId: "user-1",
    });

    expect(cachedState("auto-tagging")).toBe("queued");
    expect(manualErrors).toEqual([]);
  });

  it("stays quiet on an automatic failure", async () => {
    queryClient.setQueryData(STATUS_KEY, idleStatus());
    render();

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-tagging",
      state: "failed",
      origin: "automatic",
    });

    expect(cachedState("auto-tagging")).toBe("failed");
    expect(manualErrors).toEqual([]);
  });

  it("reports a manual failure only to the user who requested it", async () => {
    queryClient.setQueryData(STATUS_KEY, idleStatus());
    render("user-1");

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-categorization",
      state: "failed",
      origin: "manual",
      requestedByUserId: "someone-else",
    });
    expect(manualErrors).toEqual([]);

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-categorization",
      state: "failed",
      origin: "manual",
      requestedByUserId: "user-1",
    });
    expect(manualErrors).toEqual(["auto-categorization"]);
  });

  it("does not report a successful run", async () => {
    queryClient.setQueryData(STATUS_KEY, idleStatus());
    render();

    await emitLifecycle({
      recipeId: "recipe-1",
      kind: "auto-tagging",
      state: "succeeded",
      origin: "manual",
    });

    expect(cachedState("auto-tagging")).toBe("succeeded");
    expect(manualErrors).toEqual([]);
  });

  it("marks a requested kind busy immediately and sends the request", async () => {
    queryClient.setQueryData(STATUS_KEY, idleStatus());
    render();

    await act(async () => {
      latest?.request("nutrition-estimation");
    });

    expect(cachedState("nutrition-estimation")).toBe("queued");
    expect(requestMutate).toHaveBeenCalledWith({
      recipeId: "recipe-1",
      kind: "nutrition-estimation",
    });
  });
});
