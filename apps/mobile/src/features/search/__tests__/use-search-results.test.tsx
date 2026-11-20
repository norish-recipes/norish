// @vitest-environment jsdom
/** The page and the reads of a confirmed search across Offline and Live, through real queries. */
import type { ReactNode } from "react";
import React from "react";
import { resetSearchSession, searchStore } from "@/lib/search-session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryFiltersProvider } from "@norish/shared-react/recipes";

import { useSearchResults } from "../hooks/use-search-results";

const world = vi.hoisted(() => ({
  offline: false,
  reads: 0,
  items: [] as unknown[],
  // Pending reads wait here until answered; Offline they fail like an unreachable backend.
  waiting: [] as Array<() => void>,
  hold: false,
}));

vi.mock("@norish/shared-react/offline/react", async () => ({
  ...(await vi.importActual<object>("@norish/shared-react/offline/react")),
  useConnectivity: () => ({ isOffline: world.offline }),
}));
vi.mock("@norish/shared-react/trpc", () => ({
  useTRPC: () => ({
    library: {
      list: {
        infiniteQueryOptions: (input: unknown, opts: object) => ({
          ...opts,
          queryKey: [["library", "list"], { input, type: "infinite" }],
          initialPageParam: 0,
          queryFn: () => {
            world.reads += 1;

            if (world.offline) return Promise.reject(new Error("unreachable"));
            if (world.hold) {
              return new Promise((resolve) => {
                world.waiting.push(() =>
                  resolve({ items: world.items, total: world.items.length, nextCursor: null })
                );
              });
            }

            return Promise.resolve({
              items: world.items,
              total: world.items.length,
              nextCursor: null,
            });
          },
        }),
      },
    },
  }),
}));
vi.mock("../hooks/use-search-filters", async () => {
  const { useLibraryFilters } = await import("@norish/shared-react/recipes");

  return { useSearchFilters: () => useLibraryFilters((state) => state.filters) };
});

const recipe = (id: string) => ({ kind: "recipe", recipe: { id } });
const input = { text: "soup", confirmed: true, hasChips: false, focused: false };

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LibraryFiltersProvider store={searchStore}>{children}</LibraryFiltersProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => useSearchResults(input), { wrapper });

  return { ...hook, queryClient };
}

// Recovery's own step when the app is Live again.
const recover = (queryClient: QueryClient) =>
  act(() => void queryClient.refetchQueries({ type: "active" }));

describe("a confirmed search Offline", () => {
  beforeEach(() => {
    resetSearchSession();
    searchStore.getState().setFilters({ rawInput: "soup" });
    Object.assign(world, { offline: false, reads: 0, items: [], waiting: [], hold: false });
  });

  it("says it needs a connection when nothing is held, even with a read still running", async () => {
    world.hold = true;
    const { result, rerender } = mount();

    await waitFor(() => expect(world.waiting).toHaveLength(1));
    world.offline = true;
    rerender();

    expect(result.current.view).toBe("offline");
    expect(result.current.loading).toBe(false);
  });

  it("keeps held results, and a held empty answer is the real no-results page", async () => {
    world.items = [recipe("r1")];
    const { result, rerender } = mount();

    await waitFor(() => expect(result.current.view).toBe("results"));
    world.offline = true;
    rerender();
    expect(result.current.view).toBe("results");
    expect(result.current.loading).toBe(false);
  });

  it("keeps a held empty answer as no results", async () => {
    const { result, rerender } = mount();

    await waitFor(() => expect(result.current.view).toBe("none"));
    world.offline = true;
    rerender();
    expect(result.current.view).toBe("none");
  });

  it("reads once when the app is Live again: nothing held", async () => {
    world.offline = true;
    const { result, rerender, queryClient } = mount();

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    world.items = [recipe("r1")];
    world.reads = 0;
    world.offline = false;
    rerender();
    recover(queryClient);

    await waitFor(() => expect(result.current.view).toBe("results"));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(world.reads).toBe(1);
  });

  it("reads once when the app is Live again: results held", async () => {
    world.items = [recipe("r1")];
    const { result, rerender, queryClient } = mount();

    await waitFor(() => expect(result.current.view).toBe("results"));
    world.offline = true;
    rerender();
    world.reads = 0;
    world.offline = false;
    rerender();
    recover(queryClient);

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(world.reads).toBe(1);
  });

  it("stacks no reads over quick Offline and Live flaps", async () => {
    world.items = [recipe("r1")];
    const { result, rerender, queryClient } = mount();

    await waitFor(() => expect(result.current.view).toBe("results"));
    world.reads = 0;
    for (let i = 0; i < 3; i += 1) {
      world.offline = true;
      rerender();
      world.offline = false;
      rerender();
    }
    recover(queryClient);

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(world.reads).toBe(1);
  });
});
