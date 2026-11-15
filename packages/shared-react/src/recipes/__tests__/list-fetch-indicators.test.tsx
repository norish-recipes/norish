/**
 * The Library's and a cookbook's paged lists draw a spinner for the next page only: a reread of
 * the pages already showing (a subscription going live, an edit landing) draws nothing.
 */

import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCookbookRecipesQuery } from "../use-cookbook-recipes-query";
import { useLibraryQuery } from "../use-library-query";

/** Every page read waits here until the test answers it. */
const reads: Array<(page: unknown) => void> = [];

const paged = (path: string[], field: string) => ({
  queryKey: (input?: unknown) => [path, { input, type: "infinite" }],
  infiniteQueryOptions: (input: unknown, opts: object) => ({
    ...opts,
    queryKey: [path, { input, type: "infinite" }],
    initialPageParam: 0,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      new Promise((resolve) => {
        reads.push(() =>
          resolve({ [field]: [], total: 0, nextCursor: pageParam === 0 ? 1 : null })
        );
      }),
  }),
});

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    library: { list: paged(["library", "list"], "items") },
    cookbooks: { recipes: paged(["cookbooks", "recipes"], "recipes") },
  }),
}));

let queryClient: QueryClient;

beforeEach(() => {
  reads.length = 0;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  queryClient.clear();
});

const answer = () => act(() => reads.shift()?.(undefined));

describe.each([
  ["the Library", () => useLibraryQuery()],
  ["a cookbook", () => useCookbookRecipesQuery("c1")],
])("%s", (_name, useList) => {
  it("draws no next-page spinner while the pages showing are read again, and one for the next page", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(useList, { wrapper });

    await waitFor(() => expect(reads).toHaveLength(1));
    answer();
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => void queryClient.invalidateQueries());
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(result.current.isFetchingNextPage).toBe(false);
    answer();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    answer();
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
  });
});
