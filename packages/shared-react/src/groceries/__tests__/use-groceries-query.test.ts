import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useGroceriesQuery,
  useGroceryIds,
  useHasGroceries,
  useOnTheList,
  useRecurringGroceryFor,
} from "@norish/shared-react/groceries";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";
import { BASE_SPELLING_RULES } from "@norish/shared/lib/spelling-keys";

import type { GroceriesData } from "../types";
import {
  createMockGroceriesData,
  createMockGrocery,
  createMockRecurringGrocery,
} from "./test-utils";

const mockQueryKey = ["groceries", "list"];
const mockQueryOptions = vi.fn();

vi.mock("../../config", () => ({ useSpellingRules: () => BASE_SPELLING_RULES }));

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    groceries: {
      list: {
        queryKey: () => mockQueryKey,
        queryOptions: () => mockQueryOptions(),
      },
    },
  }),
}));

describe("useGroceriesQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("returns empty arrays when no data is loaded", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockGroceriesData(),
      });

      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.groceries).toEqual([]);
      expect(result.current.recurringGroceries).toEqual([]);
    });

    it("returns loading state initially", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: () => new Promise(() => {}), // Never resolves
      });

      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns groceries after successful fetch", async () => {
      const mockGroceries = [
        createMockGrocery({ id: "g1", name: "Milk" }),
        createMockGrocery({ id: "g2", name: "Bread" }),
      ];
      const mockRecurring = [createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" })];

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockGroceriesData(mockGroceries, mockRecurring),
      });

      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.groceries).toEqual(mockGroceries);
      expect(result.current.recurringGroceries).toEqual(mockRecurring);
    });

    it("handles fetch failure gracefully", async () => {
      const testError = new Error("Network error");

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => {
          throw testError;
        },
      });

      const { result } = renderHook(() => useGroceriesQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Wait for the query to complete (error or success)
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 2000 }
      );

      // When query fails, TanStack Query stores the error
      // The hook should still return empty arrays as fallback
      expect(result.current.groceries).toEqual([]);
      expect(result.current.recurringGroceries).toEqual([]);
    });
  });
});

/** Renders a hook and counts its renders, so a test sees what re-rendered it. */
function renderCounted<T>(hook: () => T, queryClient: ReturnType<typeof createTestQueryClient>) {
  let renders = 0;
  const view = renderHook(
    () => {
      renders += 1;

      return hook();
    },
    { wrapper: createTestWrapper(queryClient) }
  );

  return { ...view, renders: () => renders };
}

describe("the list's selects", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  const milk = createMockGrocery({ id: "g1", name: "milk", ingredientId: "i-milk" });
  const bread = createMockGrocery({ id: "g2", name: "bread", ingredientId: "i-bread" });
  // A write, and the observers told of it: the cache notifies on the next tick.
  const write = (data: (prev?: GroceriesData) => GroceriesData | undefined) =>
    act(async () => {
      queryClient.setQueryData<GroceriesData>(mockQueryKey, data);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const tick = (id: string) =>
    write(
      (prev) =>
        prev && {
          ...prev,
          groceries: prev.groceries.map((g) => (g.id === id ? { ...g, isDone: !g.isDone } : g)),
        }
    );

  beforeEach(() => {
    queryClient = createTestQueryClient();
    queryClient.setQueryData(mockQueryKey, createMockGroceriesData([milk, bread]));
    mockQueryOptions.mockReturnValue({ queryKey: mockQueryKey, staleTime: Infinity });
  });

  it("re-renders an ids reader when a grocery comes or goes, not when one is ticked", async () => {
    const { result, renders } = renderCounted(() => useGroceryIds(), queryClient);
    const before = renders();

    expect(result.current).toEqual(["g1", "g2"]);
    await tick("g1");
    expect(renders()).toBe(before);

    await write(() => createMockGroceriesData([bread]));
    expect(result.current).toEqual(["g2"]);
  });

  it("leaves an ids reader that isn't live alone, and reads the list again when it renders", async () => {
    const { result, renders, rerender } = renderCounted(() => useGroceryIds(false), queryClient);
    const before = renders();

    await write(() => createMockGroceriesData([bread]));
    expect(renders()).toBe(before);

    rerender();
    expect(result.current).toEqual(["g2"]);
  });

  it("re-renders a has-groceries reader only when the list empties or fills", async () => {
    const { result, renders } = renderCounted(() => useHasGroceries(), queryClient);
    const before = renders();

    expect(result.current).toBe(true);
    await write(() => createMockGroceriesData([bread]));
    expect(renders()).toBe(before);

    await write(() => createMockGroceriesData([]));
    expect(result.current).toBe(false);
  });

  it("re-renders an on-the-list reader only when its answer changes", async () => {
    const kept = [
      {
        id: "p-milk",
        userId: "u",
        ingredientId: "i-milk",
        name: "milk",
        ancestorIds: [],
        localeNames: {},
        version: 1,
      },
      {
        id: "p-salt",
        userId: "u",
        ingredientId: "i-salt",
        name: "salt",
        ancestorIds: [],
        localeNames: {},
        version: 1,
      },
    ];
    const { result, renders } = renderCounted(() => useOnTheList(kept), queryClient);

    expect(result.current).toEqual(["p-milk"]);
    const before = renders();

    // Bread is no Pantry food: ticking it changes no answer here.
    await tick("g2");
    expect(renders()).toBe(before);

    // Milk bought: no longer still to buy.
    await tick("g1");
    expect(result.current).toEqual([]);
  });

  it("finds a grocery's recurring row, re-rendering its reader only when that row changes", async () => {
    const eggs = createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" });
    const recurringMilk = { ...milk, recurringGroceryId: "r1" };

    await write(() => createMockGroceriesData([recurringMilk, bread], [eggs]));
    const { result, renders } = renderCounted(() => useRecurringGroceryFor("g1"), queryClient);

    expect(result.current).toEqual(eggs);
    const before = renders();

    await tick("g2");
    expect(renders()).toBe(before);

    await write((prev) => prev && { ...prev, recurringGroceries: [{ ...eggs, name: "Eggs" }] });
    expect(result.current?.name).toBe("Eggs");

    expect(
      renderCounted(() => useRecurringGroceryFor("g2"), queryClient).result.current
    ).toBeNull();
    expect(
      renderCounted(() => useRecurringGroceryFor(null), queryClient).result.current
    ).toBeNull();
  });
});
