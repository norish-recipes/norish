import type { ReactNode } from "react";
import { createElement } from "react";
import { useStoresMutations } from "@/hooks/stores/use-stores-mutations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDeleteMutation = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");

  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: [
        {
          id: "store-1",
          version: 6,
          name: "Pantry",
          color: "primary",
          icon: "ShoppingBagIcon",
          sortOrder: 0,
          userId: "user-1",
        },
      ],
      error: null,
      isLoading: false,
    })),
    useMutation: vi.fn((options?: { mutationFn?: (...args: unknown[]) => unknown }) => ({
      mutate: options?.mutationFn ?? vi.fn(),
      isPending: false,
    })),
  };
});

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
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

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useStoresMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the store version with the grocery snapshot on delete", () => {
    const { result } = renderHook(() => useStoresMutations(), {
      wrapper: createWrapper(),
    });

    const grocerySnapshot = [
      { id: "g1", version: 2 },
      { id: "g2", version: 5 },
    ];

    act(() => {
      result.current.deleteStore("store-1", true, grocerySnapshot);
    });

    expect(mockDeleteMutation).toHaveBeenCalledWith(
      {
        storeId: "store-1",
        version: 6,
        deleteGroceries: true,
        grocerySnapshot,
      },
      expect.any(Object)
    );
  });
});
