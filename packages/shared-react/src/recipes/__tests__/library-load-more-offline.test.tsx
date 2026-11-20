/** Reaching the end of a held list fetches nothing while Offline, and the next page once Live. */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useLibraryQuery } from "../use-library-query";

const world = vi.hoisted(() => ({ offline: false, pages: [] as number[], lastPage: 1 }));

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

            return Promise.resolve({
              items: [],
              total: 0,
              nextCursor: pageParam < world.lastPage ? pageParam + 1 : null,
            });
          },
        }),
      },
    },
  }),
}));

describe("loadMore", () => {
  it("fetches nothing Offline", async () => {
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
  });

  it("runs a loadMore swallowed Offline once when Live again, without another call", async () => {
    world.pages = [];
    world.offline = false;
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

    world.offline = false;
    rerender();
    await waitFor(() => expect(world.pages).toEqual([0, 1]));
    rerender();
    await act(async () => {});
    expect(world.pages).toEqual([0, 1]);
  });

  it("asks again when Recovery's refetch cancelled the page it ran", async () => {
    world.pages = [];
    world.offline = false;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useLibraryQuery(), { wrapper });

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    world.offline = true;
    rerender();
    act(() => result.current.loadMore());

    world.offline = false;
    rerender();
    // Recovery refetches the active queries the moment the app is Live, which cancels a page in flight.
    await act(async () => {
      await queryClient.refetchQueries({ type: "active" });
    });

    await waitFor(() => expect(result.current.hasMore).toBe(false));
  });

  it("runs nothing when the query changed meanwhile", async () => {
    world.pages = [];
    world.offline = false;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) => useLibraryQuery({ search }),
      { wrapper, initialProps: { search: "a" } }
    );

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    world.offline = true;
    rerender({ search: "a" });
    act(() => result.current.loadMore());
    rerender({ search: "b" });
    world.offline = false;
    rerender({ search: "b" });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => {});

    expect(world.pages).toEqual([0, 0]);
  });

  it("forgets the ask when the page count changed before Live, fetching no run of pages", async () => {
    world.pages = [];
    world.offline = false;
    world.lastPage = 5;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useLibraryQuery(), { wrapper });

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(() => result.current.loadMore());
    await waitFor(() => expect(world.pages).toEqual([0, 1]));
    await act(() => result.current.loadMore());
    await waitFor(() => expect(world.pages).toEqual([0, 1, 2]));

    world.offline = true;
    rerender();
    act(() => result.current.loadMore());
    // The list shrank meanwhile: only its first page is held.
    act(() =>
      queryClient.setQueryData(
        result.current.queryKey,
        (data: { pages: unknown[]; pageParams: unknown[] }) => ({
          pages: data.pages.slice(0, 1),
          pageParams: data.pageParams.slice(0, 1),
        })
      )
    );

    world.offline = false;
    rerender();
    await act(async () => {});
    await act(async () => {});

    expect(world.pages).toEqual([0, 1, 2]);
    world.lastPage = 1;
  });
});
