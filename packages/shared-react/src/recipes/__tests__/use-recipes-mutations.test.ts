import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InfiniteRecipeData } from "../library-cache";
import { createTestQueryClient, createTestWrapper } from "../../groceries/__tests__/test-utils";
import { useRecipesMutations } from "../use-recipes-mutations";

const sendCreate = vi.hoisted(() => vi.fn());

vi.mock("../../trpc", () => {
  const key =
    (...path: string[]) =>
    (input?: unknown) => [path, ...(input === undefined ? [] : [{ input }])];
  const procedure = (mutationFn: (input: unknown) => unknown) => ({
    mutationOptions: (options?: object) => ({ ...options, mutationFn }),
  });

  return {
    useTRPC: () => ({
      recipes: {
        list: { queryKey: key("recipes", "list") },
        get: { queryKey: key("recipes", "get") },
        getPending: { queryKey: key("recipes", "getPending") },
        create: procedure(sendCreate),
        importFromUrl: procedure(vi.fn()),
        importFromImages: procedure(vi.fn()),
        importFromPaste: procedure(vi.fn()),
        update: procedure(vi.fn()),
        delete: procedure(vi.fn()),
        convertMeasurements: procedure(vi.fn()),
      },
      library: { list: { queryKey: key("library", "list") } },
    }),
  };
});

const LIST_KEY = [["recipes", "list"], { input: {} }];
const detailKey = (id: string) => [["recipes", "get"], { input: { id } }];

function recipe(id: string, name: string) {
  return { id, name, systemUsed: "metric" as const, recipeIngredients: [], steps: [], tags: [] };
}

describe("useRecipesMutations", () => {
  beforeEach(() => sendCreate.mockReset());

  it("rolls back two overlapping creates that fail, lists and details as they were", async () => {
    const queryClient = createTestQueryClient();
    const before: InfiniteRecipeData = {
      pages: [{ recipes: [], total: 0, nextCursor: null }],
      pageParams: [0],
    };
    const answers = [Promise.withResolvers<never>(), Promise.withResolvers<never>()];
    const soup = recipe("11111111-1111-4111-8111-111111111111", "Soup");
    const stew = recipe("22222222-2222-4222-8222-222222222222", "Stew");

    queryClient.setQueryData(LIST_KEY, before);
    sendCreate
      .mockImplementationOnce(() => answers[0]!.promise)
      .mockImplementationOnce(() => answers[1]!.promise);

    const { result } = renderHook(() => useRecipesMutations(), {
      wrapper: createTestWrapper(queryClient),
    });

    act(() => result.current.createRecipe(soup));
    act(() => result.current.createRecipe(stew));
    await act(async () => {
      await vi.waitFor(() =>
        expect(queryClient.getQueryData<InfiniteRecipeData>(LIST_KEY)?.pages[0]?.total).toBe(2)
      );
    });
    await act(async () => answers[0]!.reject(new Error("Bad recipe")));
    await act(async () => answers[1]!.reject(new Error("Bad recipe")));
    await act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });

    expect(queryClient.getQueryData(LIST_KEY)).toEqual(before);
    expect(queryClient.getQueryData(detailKey(soup.id))).toBeUndefined();
    expect(queryClient.getQueryData(detailKey(stew.id))).toBeUndefined();
  });
});
