import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RecipeShareSummaryDto } from "@norish/shared/contracts";
import { createRecipeHooks } from "@norish/shared-react/hooks";
import * as recipes from "@norish/shared-react/recipes";

import type { CreateRecipeHooksOptions } from "../../hooks/recipes/types";
import { trackedEvent } from "../../../__tests__/realtime/tracked-event";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => {
  const actual = await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  );

  return {
    ...actual,
    useSubscription: useSubscriptionMock,
  };
});

function createMockShare(overrides: Partial<RecipeShareSummaryDto> = {}): RecipeShareSummaryDto {
  const now = new Date();

  return {
    id: "123e4567-e89b-12d3-a456-426614174001",
    userId: "user-1",
    recipeId: "123e4567-e89b-12d3-a456-426614174000",
    expiresAt: null,
    revokedAt: null,
    lastAccessedAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    status: "active",
    ...overrides,
  };
}

function createSubscriptionOptionsFactory(event: string) {
  return (
    _input: undefined,
    options?: {
      enabled?: boolean;
      onData?: (payload: unknown) => void;
      onError?: (error: unknown) => void;
    }
  ) => ({
    event,
    ...options,
  });
}

vi.mock("../../trpc", () => ({ useTRPC: () => trpc }));

const sentShareWrites: [string, unknown][] = [];

/** A share write that answers with the share, as the server does. */
function shareWrite(name: string) {
  return {
    mutationOptions: (options?: object) => ({
      ...options,
      mutationFn: async (input: { id: string }) => {
        sentShareWrites.push([name, input]);

        return { id: input.id, recipeId: "recipe-1" };
      },
    }),
  };
}

function shareListKey({ recipeId }: { recipeId: string }) {
  return [["recipes", "shareList"], { input: { recipeId }, type: "query" }];
}

const trpc = {
  recipes: {
    shareList: {
      queryKey: shareListKey,
      queryOptions: (input: { recipeId: string }) => ({
        queryKey: shareListKey(input),
        queryFn: () => new Promise(() => {}),
      }),
    },
    shareListMine: {
      queryKey: () => [["recipes", "shareListMine"], { type: "query" }],
    },
    shareListAdmin: {
      queryKey: () => [["recipes", "shareListAdmin"], { type: "query" }],
    },
    shareGet: {
      queryKey: ({ id }: { id: string }) => [
        ["recipes", "shareGet"],
        { input: { id }, type: "query" },
      ],
    },
    onShareEvent: { subscriptionOptions: createSubscriptionOptionsFactory("onShareEvent") },
    shareCreate: shareWrite("shareCreate"),
    shareUpdate: shareWrite("shareUpdate"),
    shareRevoke: shareWrite("shareRevoke"),
    shareReactivate: shareWrite("shareReactivate"),
    shareDelete: shareWrite("shareDelete"),
  },
};

const mountedRoots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of mountedRoots.splice(0)) {
    flushSync(() => {
      root.unmount();
    });

    container.remove();
  }

  useSubscriptionMock.mockReset();
  sentShareWrites.length = 0;
});

describe("recipe share hooks", () => {
  it("the recipe hook factory hands back the plain share hooks", () => {
    const hooks = createRecipeHooks({
      useTRPC: () => trpc as unknown as ReturnType<CreateRecipeHooksOptions["useTRPC"]>,
    });

    expect(hooks.shares.useRecipeSharesQuery).toBe(recipes.useRecipeSharesQuery);
    expect(hooks.shares.useRecipeShareMutations).toBe(recipes.useRecipeShareMutations);
    expect(hooks.shares.useRecipeShareSubscription).toBe(recipes.useRecipeShareSubscription);
    expect(hooks.shares.useSharedRecipeQuery).toBe(recipes.useSharedRecipeQuery);
  });

  it("reads a recipe's shares from the cache", () => {
    const queryClient = new QueryClient();
    const shares = [createMockShare({ recipeId: "recipe-1" })];

    queryClient.setQueryData(trpc.recipes.shareList.queryKey({ recipeId: "recipe-1" }), shares);

    const { result } = renderHook(() => recipes.useRecipeSharesQuery("recipe-1"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current.shares).toEqual(shares);
    expect(result.current.isLoading).toBe(false);
  });

  it("revokes, reactivates and deletes a share by id and version, then reads the list again", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const share = createMockShare({ recipeId: "recipe-1" });
    const listKey = trpc.recipes.shareList.queryKey({ recipeId: "recipe-1" });

    const { result } = renderHook(() => recipes.useRecipeShareMutations("recipe-1"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    act(() => result.current.revokeShare(share.id, share.version));
    act(() => result.current.reactivateShare(share.id, share.version));
    act(() => result.current.deleteShare(share.id, share.version));

    await vi.waitFor(() => expect(sentShareWrites).toHaveLength(3));
    expect(sentShareWrites).toEqual([
      ["shareRevoke", { id: share.id, version: share.version }],
      ["shareReactivate", { id: share.id, version: share.version }],
      ["shareDelete", { id: share.id, version: share.version }],
    ]);
    await vi.waitFor(() =>
      expect(
        invalidateQueries.mock.calls.filter(
          ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(listKey)
        )
      ).toHaveLength(3)
    );
  });

  it("invalidates recipe share queries when share lifecycle events arrive", () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const removeQueries = vi.spyOn(queryClient, "removeQueries");

    function TestComponent() {
      recipes.useRecipeShareSubscription("recipe-1");
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ root, container });

    flushSync(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );
    });

    // One subscription carries every share lifecycle transition.
    expect(useSubscriptionMock).toHaveBeenCalledTimes(1);

    const options = useSubscriptionMock.mock.calls[0]?.[0] as {
      onData?: (event: unknown) => void;
    };

    options.onData?.(
      trackedEvent({
        kind: "created",
        share: { type: "created", recipeId: "recipe-1", shareId: "share-1", version: 1 },
      })
    );

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [["recipes", "shareList"], { input: { recipeId: "recipe-1" }, type: "query" }],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [["recipes", "shareGet"], { input: { id: "share-1" }, type: "query" }],
    });

    options.onData?.(
      trackedEvent({
        kind: "deleted",
        share: { type: "deleted", recipeId: "recipe-1", shareId: "share-1", version: 2 },
      })
    );

    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: [["recipes", "shareGet"], { input: { id: "share-1" }, type: "query" }],
    });
  });
});
