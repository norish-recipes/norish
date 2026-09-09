/**
 * A Store's aisles changed on another screen: the links of an aisle the Store
 * no longer has went with it on the server, and so must go here, at once.
 */
import type { ReactNode } from "react";
import { createElement } from "react";
import { useStoresSubscription } from "@/hooks/stores/use-stores-subscription";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Callback = (data: { payload: unknown }) => void;

const callbacks: Record<string, Callback> = {};

vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: vi.fn(() => ({ data: undefined, error: null, isLoading: false })),
}));

const STORES_KEY = [["stores", "list"], { type: "query" }];
const LINKS_KEY = [["stores", "aisleLinks"], { type: "query" }];

function subscription(name: string) {
  return {
    subscriptionOptions: (_input: unknown, options: { onData: Callback }) => {
      callbacks[name] = options.onData;

      return { queryKey: [name] };
    },
  };
}

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    stores: {
      list: { queryKey: () => STORES_KEY },
      aisleLinks: { queryKey: () => LINKS_KEY },
      onCreated: subscription("onCreated"),
      onUpdated: subscription("onUpdated"),
      onDeleted: subscription("onDeleted"),
      onReordered: subscription("onReordered"),
    },
  }),
}));

const MARKT = "store-markt";
const ZUIVEL = "aisle-zuivel";
const BROOD = "aisle-brood";

function aisle(id: string, name: string, sortOrder: number) {
  return { id, storeId: MARKT, name, sortOrder, version: 1 };
}

const MARKT_STORE = {
  id: MARKT,
  userId: "user-1",
  name: "Markt",
  color: "primary",
  icon: "ShoppingBagIcon",
  website: null,
  searchAddress: null,
  sortOrder: 0,
  version: 1,
  aisles: [aisle(ZUIVEL, "Zuivel", 0), aisle(BROOD, "Brood", 1)],
};

const LINKS = [
  { storeId: MARKT, normalizedName: "melk", aisleId: ZUIVEL },
  { storeId: MARKT, normalizedName: "brood", aisleId: BROOD },
  { storeId: "store-bakker", normalizedName: "croissant", aisleId: "aisle-elsewhere" },
];

describe("useStoresSubscription, and what a Store's aisles take with them", () => {
  let client: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(STORES_KEY, [MARKT_STORE]);
    client.setQueryData(LINKS_KEY, LINKS);
    invalidate = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useStoresSubscription(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    });
  });

  it("drops the links of an aisle the Store no longer has, and reads the links again", () => {
    act(() => {
      callbacks.onUpdated?.({
        payload: { store: { ...MARKT_STORE, version: 2, aisles: [aisle(ZUIVEL, "Zuivel", 0)] } },
      });
    });

    expect(client.getQueryData(LINKS_KEY)).toEqual([
      { storeId: MARKT, normalizedName: "melk", aisleId: ZUIVEL },
      { storeId: "store-bakker", normalizedName: "croissant", aisleId: "aisle-elsewhere" },
    ]);
    expect(client.getQueryData(STORES_KEY)).toEqual([
      expect.objectContaining({ id: MARKT, version: 2, aisles: [aisle(ZUIVEL, "Zuivel", 0)] }),
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: LINKS_KEY });
  });

  it("keeps every link of a Store whose aisles were only renamed", () => {
    act(() => {
      callbacks.onUpdated?.({
        payload: {
          store: {
            ...MARKT_STORE,
            aisles: [aisle(ZUIVEL, "Zuivel en kaas", 0), aisle(BROOD, "Brood", 1)],
          },
        },
      });
    });

    expect(client.getQueryData(LINKS_KEY)).toEqual(LINKS);
  });

  it("drops every link of a Store that was deleted", () => {
    act(() => {
      callbacks.onDeleted?.({ payload: { storeId: MARKT, deletedGroceryIds: [] } });
    });

    expect(client.getQueryData(LINKS_KEY)).toEqual([
      { storeId: "store-bakker", normalizedName: "croissant", aisleId: "aisle-elsewhere" },
    ]);
    expect(client.getQueryData(STORES_KEY)).toEqual([]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: LINKS_KEY });
  });
});
