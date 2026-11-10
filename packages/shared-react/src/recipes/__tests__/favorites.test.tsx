import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useFavoritesMutation } from "../use-favorites-mutation";
import { useFavoritesQuery } from "../use-favorites-query";

type FavoritesData = { favoriteIds: string[]; favoriteVersions: Record<string, number> };

const server = vi.hoisted(() => ({
  list: vi.fn<() => Promise<FavoritesData>>(),
  toggle: vi.fn<(input: unknown) => Promise<unknown>>(),
}));

vi.mock("../../trpc", () => {
  const listKey = [["favorites", "list"], { type: "query" }];

  return {
    useTRPC: () => ({
      favorites: {
        list: {
          queryKey: () => listKey,
          queryOptions: () => ({ queryKey: listKey, queryFn: () => server.list() }),
        },
        toggle: {
          mutationOptions: (options: object) => ({ ...options, mutationFn: server.toggle }),
        },
      },
    }),
  };
});

const KEY = [["favorites", "list"], { type: "query" }];

describe("useFavoritesQuery", () => {
  beforeEach(() => server.list.mockReset());

  it("reads the favourite ids and their versions", async () => {
    server.list.mockResolvedValue({
      favoriteIds: ["recipe-1", "recipe-2"],
      favoriteVersions: { "recipe-1": 1, "recipe-2": 2 },
    });

    const { result } = renderHook(() => useFavoritesQuery(), {
      wrapper: createTestWrapper(createTestQueryClient()),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.favoriteIds).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.favoriteIds).toEqual(["recipe-1", "recipe-2"]);
    expect(result.current.isFavorite("recipe-1")).toBe(true);
    expect(result.current.isFavorite("recipe-9")).toBe(false);
    expect(result.current.getFavoriteVersion("recipe-2")).toBe(2);
  });

  it("reads the list again when invalidated", async () => {
    server.list
      .mockResolvedValueOnce({ favoriteIds: ["recipe-1"], favoriteVersions: {} })
      .mockResolvedValueOnce({ favoriteIds: ["recipe-1", "recipe-2"], favoriteVersions: {} });

    const { result } = renderHook(() => useFavoritesQuery(), {
      wrapper: createTestWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.favoriteIds).toEqual(["recipe-1"]));
    act(() => result.current.invalidate());
    await waitFor(() => expect(result.current.favoriteIds).toEqual(["recipe-1", "recipe-2"]));
  });
});

describe("useFavoritesMutation", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let answer: PromiseWithResolvers<unknown>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    answer = Promise.withResolvers();
    server.toggle.mockReset().mockImplementation(() => answer.promise);
  });

  const render = () =>
    renderHook(() => useFavoritesMutation(), { wrapper: createTestWrapper(queryClient) }).result;
  const cached = () => queryClient.getQueryData<FavoritesData>(KEY);
  const settled = () => waitFor(() => expect(queryClient.isMutating()).toBe(0));

  it("favourites a recipe at once and sends the final state", async () => {
    queryClient.setQueryData<FavoritesData>(KEY, { favoriteIds: [], favoriteVersions: {} });
    const result = render();

    act(() => result.current.toggleFavorite("recipe-1"));

    await waitFor(() => expect(cached()?.favoriteIds).toEqual(["recipe-1"]));
    expect(server.toggle).toHaveBeenCalledWith(
      { recipeId: "recipe-1", isFavorite: true, version: undefined },
      expect.anything()
    );
  });

  it("unfavourites a recipe with the version it was read at, and drops that version", async () => {
    queryClient.setQueryData<FavoritesData>(KEY, {
      favoriteIds: ["recipe-1", "recipe-2"],
      favoriteVersions: { "recipe-1": 4, "recipe-2": 6 },
    });
    const result = render();

    act(() => result.current.toggleFavorite("recipe-1"));

    await waitFor(() =>
      expect(cached()).toEqual({ favoriteIds: ["recipe-2"], favoriteVersions: { "recipe-2": 6 } })
    );
    expect(server.toggle).toHaveBeenCalledWith(
      { recipeId: "recipe-1", isFavorite: false, version: 4 },
      expect.anything()
    );
  });

  it("favourites a recipe when no list was read yet", async () => {
    const result = render();

    act(() => result.current.toggleFavorite("recipe-1"));

    await waitFor(() => expect(cached()?.favoriteIds).toEqual(["recipe-1"]));
  });

  it("puts the list back when the write fails", async () => {
    queryClient.setQueryData<FavoritesData>(KEY, {
      favoriteIds: ["recipe-1"],
      favoriteVersions: {},
    });
    const result = render();

    act(() => result.current.toggleFavorite("recipe-2"));
    await waitFor(() => expect(cached()?.favoriteIds).toEqual(["recipe-1", "recipe-2"]));
    await act(async () => answer.reject(new Error("Failed")));
    await settled();

    expect(cached()?.favoriteIds).toEqual(["recipe-1"]);
  });

  it("keeps the favourite when the backend is unreachable and the write is queued", async () => {
    queryClient.setQueryData<FavoritesData>(KEY, {
      favoriteIds: ["recipe-1"],
      favoriteVersions: {},
    });
    const result = render();

    act(() => result.current.toggleFavorite("recipe-2"));
    await waitFor(() => expect(cached()?.favoriteIds).toEqual(["recipe-1", "recipe-2"]));
    await act(async () => answer.reject(new TRPCClientError("Request failed")));
    await settled();

    expect(cached()?.favoriteIds).toEqual(["recipe-1", "recipe-2"]);
  });

  it("is toggling while the write is on its way", async () => {
    const result = render();

    expect(result.current.isToggling).toBe(false);
    act(() => result.current.toggleFavorite("recipe-1"));
    await waitFor(() => expect(result.current.isToggling).toBe(true));
    await act(async () => answer.resolve({}));
    await waitFor(() => expect(result.current.isToggling).toBe(false));
  });
});
