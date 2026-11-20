/** Reaching the end of a held list fetches nothing while Offline, and the next page once Live. */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useLibraryQuery } from "../use-library-query";

const world = vi.hoisted(() => ({ offline: false, pages: [] as number[] }));

vi.mock("../../offline/react", () => ({ useConnectivity: () => ({ isOffline: world.offline }) }));
vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    library: {
      list: {
        infiniteQueryOptions: (input: unknown, opts: object) => ({
          ...opts,
          queryKey: [["library", "list"], { input, type: "infinite" }],
          initialPageParam: 0,
          queryFn: ({ pageParam }: { pageParam: number }) => {
            world.pages.push(pageParam);

            return Promise.resolve({ items: [], total: 0, nextCursor: pageParam === 0 ? 1 : null });
          },
        }),
      },
    },
  }),
}));

describe("loadMore", () => {
  it("fetches nothing Offline and the next page Live", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useLibraryQuery(), { wrapper });

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    world.offline = true;
    rerender();
    act(() => result.current.loadMore());
    expect(world.pages).toEqual([0]);
    expect(result.current.isFetchingNextPage).toBe(false);

    world.offline = false;
    rerender();
    act(() => result.current.loadMore());
    await waitFor(() => expect(world.pages).toEqual([0, 1]));
  });
});
