import type { ReactNode } from "react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useStoresMutations } from "@norish/shared-react/groceries";

const mockDeleteMutation = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");

  return {
    ...actual,
    useMutation: vi.fn((options?: { mutationFn?: (...args: unknown[]) => unknown }) => ({
      mutate: options?.mutationFn ?? vi.fn(),
      isPending: false,
    })),
  };
});

vi.mock("../trpc", () => ({
  useTRPC: () => ({
    groceries: { list: { queryKey: () => ["groceries", "list"] } },
    stores: {
      list: {
        queryKey: vi.fn(() => ["stores", "list"]),
        queryOptions: vi.fn(() => ({
          queryKey: ["stores", "list"],
          queryFn: vi.fn(async () => []),
        })),
      },
      create: { mutationOptions: vi.fn() },
      update: { mutationOptions: vi.fn() },
      delete: { mutationOptions: vi.fn(() => ({ mutationFn: mockDeleteMutation })) },
      reorder: { mutationOptions: vi.fn() },
      checkSearchAddress: { mutationOptions: vi.fn() },
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  queryClient.setQueryData(
    ["stores", "list"],
    [
      {
        id: "store-1",
        version: 6,
        name: "Pantry",
        color: "primary",
        website: null,
        searchAddress: null,
        sortOrder: 0,
        userId: "user-1",
        aisles: [],
      },
    ]
  );
  queryClient.setQueryData(["groceries", "list"], {
    groceries: [
      { id: "g1", version: 2, storeId: "store-1" },
      { id: "g2", version: 5, storeId: "store-1" },
      { id: "g3", version: 1, storeId: "store-2" },
    ],
    recurringGroceries: [],
    recipeMap: {},
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useStoresMutations", () => {
  it("sends the store version with its groceries as held on delete", () => {
    const { result } = renderHook(() => useStoresMutations(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.deleteStore("store-1", true);
    });

    expect(mockDeleteMutation).toHaveBeenCalledWith(
      {
        storeId: "store-1",
        version: 6,
        deleteGroceries: true,
        grocerySnapshot: [
          { id: "g1", version: 2 },
          { id: "g2", version: 5 },
        ],
      },
      expect.any(Object)
    );
  });
});
