/** Chips name their foods from one read for the whole set, primed by what added them. */
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOfflineQueryClient } from "../../offline/cache-manager";
import {
  useIngredientName,
  useIngredientNames,
  usePrimeIngredientName,
} from "../use-ingredient-names";

const mocks = vi.hoisted(() => ({
  names: {} as Record<string, string>,
  reads: [] as string[][],
}));

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    ingredients: {
      names: {
        pathKey: () => [["ingredients", "names"]],
        queryKey: (input: { ids: string[] }) => [["ingredients", "names"], { input }],
        queryOptions: (input: { ids: string[] }) => ({
          queryKey: [["ingredients", "names"], { input }],
          queryFn: async () => {
            mocks.reads.push(input.ids);

            return Object.fromEntries(
              input.ids.flatMap((id) =>
                id in mocks.names ? [[id, { name: mocks.names[id], localeNames: {} }]] : []
              )
            );
          },
        }),
      },
    },
  }),
}));

/** A chip row: one read for the set, each chip's name, and the prime an add calls. */
function useChips(ids: string[]) {
  useIngredientNames(ids);

  return {
    first: useIngredientName(ids[0] ?? null)?.name,
    last: useIngredientName(ids.at(-1) ?? null)?.name,
    prime: usePrimeIngredientName(),
  };
}

function render(initial: string[]) {
  // The app's client: its staleTime is what lets a cached set skip the read.
  const client = createOfflineQueryClient();
  const hook = renderHook(({ ids }) => useChips(ids), {
    initialProps: { ids: initial },
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

  return { client, ...hook };
}

beforeEach(() => {
  mocks.names = {};
  mocks.reads = [];
});

describe("Ingredient chip names", () => {
  it("names an added food in the first render after the add, reading nothing", async () => {
    mocks.names = { a: "onion" };

    const { result, rerender } = render(["a"]);

    await waitFor(() => expect(result.current.first).toBe("onion"));
    mocks.reads = [];

    act(() => result.current.prime({ id: "b", name: "garlic", localeNames: {} }));
    rerender({ ids: ["a", "b"] });

    expect(result.current.last).toBe("garlic");
    expect(result.current.first).toBe("onion");
    expect(mocks.reads).toEqual([]);
  });

  it("shows a renamed food's new name after a refetch", async () => {
    const { client, result, rerender } = render([]);

    act(() => result.current.prime({ id: "a", name: "onion", localeNames: {} }));
    rerender({ ids: ["a"] });
    expect(result.current.first).toBe("onion");

    mocks.names = { a: "red onion" };
    await act(() => client.invalidateQueries());

    await waitFor(() => expect(result.current.first).toBe("red onion"));
  });

  it("has no name for a food no read answers", async () => {
    const { result } = render(["gone"]);

    await waitFor(() => expect(mocks.reads).toEqual([["gone"]]));
    expect(result.current.first).toBeUndefined();
  });

  it("reads every chip's name in one request", async () => {
    mocks.names = { a: "onion", b: "garlic", c: "leek" };

    const { result } = render(["a", "b", "c"]);

    await waitFor(() => expect(result.current.last).toBe("leek"));
    expect(mocks.reads).toEqual([["a", "b", "c"]]);
  });
});
