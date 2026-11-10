import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PendingRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";

import { createTestQueryClient, createTestWrapper } from "../../groceries/__tests__/test-utils";
import { useRecipesQuery } from "../use-recipes-query";

type Page = { recipes: RecipeDashboardDTO[]; total: number; nextCursor: number | null };

const server = vi.hoisted(() => ({
  list: vi.fn<(input: Record<string, unknown>) => Promise<Page>>(),
  getPending: vi.fn<() => Promise<PendingRecipeDTO[]>>(),
}));

vi.mock("../../trpc", () => {
  const listKey = (input: unknown) => [["recipes", "list"], { input, type: "infinite" }];
  const pendingKey = [["recipes", "getPending"], { type: "query" }];

  return {
    useTRPC: () => ({
      recipes: {
        list: {
          queryKey: listKey,
          infiniteQueryOptions: (input: Record<string, unknown>, options: object) => ({
            ...options,
            queryKey: listKey(input),
            initialPageParam: 0,
            queryFn: ({ pageParam }: { pageParam: number }) =>
              server.list({ ...input, cursor: pageParam }),
          }),
        },
        getPending: {
          queryKey: () => pendingKey,
          queryOptions: () => ({ queryKey: pendingKey, queryFn: () => server.getPending() }),
        },
      },
      library: { list: { queryKey: () => [["library", "list"], { type: "infinite" }] } },
    }),
  };
});

function recipe(id: string, name: string): RecipeDashboardDTO {
  return {
    id,
    userId: "user-1",
    name,
    description: null,
    notes: null,
    url: null,
    image: null,
    servings: 4,
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    calories: null,
    originCountry: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    tags: [],
    categories: [],
    version: 1,
  };
}

const render = (filters?: Parameters<typeof useRecipesQuery>[0]) =>
  renderHook(() => useRecipesQuery(filters), {
    wrapper: createTestWrapper(createTestQueryClient()),
  }).result;

describe("useRecipesQuery", () => {
  beforeEach(() => {
    server.list.mockReset();
    server.getPending.mockReset().mockResolvedValue([]);
  });

  it("reads the recipes and their total", async () => {
    const recipes = [recipe("r1", "Pasta"), recipe("r2", "Pizza")];

    server.list.mockResolvedValue({ recipes, total: 2, nextCursor: null });
    const result = render();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.recipes).toEqual([]);
    expect(result.current.total).toBe(0);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.recipes).toEqual(recipes);
    expect(result.current.total).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });

  it("holds an empty list and the error when the read fails", async () => {
    const failure = new Error("Network error");

    server.list.mockRejectedValue(failure);
    const result = render();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.recipes).toEqual([]);
    expect(result.current.error).toBe(failure);
  });

  it("asks the server for the filters it was given, with the defaults beside them", async () => {
    server.list.mockResolvedValue({ recipes: [], total: 0, nextCursor: null });
    const result = render({ search: "pasta", tags: ["dinner", "easy"], sortMode: "titleAsc" });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(server.list).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "pasta",
        tags: ["dinner", "easy"],
        sortMode: "titleAsc",
        filterMode: "OR",
        limit: 100,
        cursor: 0,
      })
    );
  });

  it("reads the next page when there is one, after the first", async () => {
    server.list
      .mockResolvedValueOnce({ recipes: [recipe("r1", "Pasta")], total: 2, nextCursor: 1 })
      .mockResolvedValueOnce({ recipes: [recipe("r2", "Pizza")], total: 2, nextCursor: null });
    const result = render();

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.recipes.map((r) => r.id)).toEqual(["r1", "r2"]));

    expect(server.list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 1 }));
    expect(result.current.hasMore).toBe(false);
  });

  it("names the pending imports, and the ones it is told about", async () => {
    server.list.mockResolvedValue({ recipes: [], total: 0, nextCursor: null });
    server.getPending.mockResolvedValue([{ recipeId: "pending-1", url: "", addedAt: 0 }]);
    const result = render();

    await waitFor(() => expect([...result.current.pendingRecipeIds]).toEqual(["pending-1"]));
    act(() => result.current.addPendingRecipe("pending-2"));
    await waitFor(() =>
      expect([...result.current.pendingRecipeIds]).toEqual(["pending-1", "pending-2"])
    );
    act(() => result.current.removePendingRecipe("pending-1"));
    await waitFor(() => expect([...result.current.pendingRecipeIds]).toEqual(["pending-2"]));
  });
});
