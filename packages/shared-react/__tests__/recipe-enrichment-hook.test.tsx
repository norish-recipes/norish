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
      { kind: "auto-tagging", state: "idle", origin: null },
      { kind: "allergy-detection", state: "idle", origin: null },
      { kind: "auto-categorization", state: "idle", origin: null },
      { kind: "nutrition-estimation", state: "idle", origin: null },
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
    options?.onData?.({ payload });
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
        { kind: "auto-tagging", state: "processing", origin: "automatic" },
        { kind: "allergy-detection", state: "failed", origin: "automatic" },
        { kind: "auto-categorization", state: "succeeded", origin: "manual" },
        { kind: "nutrition-estimation", state: "idle", origin: null },
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
      requestedByUserId: "user-1",
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
