import { dehydrate, hydrate } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformAdapter } from "@norish/shared-react/platform";
import { useGroceriesMutations } from "@norish/shared-react/groceries";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { isQueuedOutboxSignal, markOutboxAdmissionFailed } from "@norish/shared/lib/trpc-errors";

import {
  createMockGroceriesData,
  createMockGrocery,
  createMockRecurringGrocery,
  createTestQueryClient,
  createTestWrapper,
} from "./test-utils";

// What each procedure is sent; a test answers or refuses it by its implementation.
const _mockMutations = {
  create: vi.fn(),
  toggle: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createRecurring: vi.fn(),
  updateRecurring: vi.fn(),
  deleteRecurring: vi.fn(),
  detachRecurring: vi.fn(),
  checkRecurring: vi.fn(),
  assignToStore: vi.fn(),
  reorderInStore: vi.fn(),
  markAllDone: vi.fn(),
  deleteDone: vi.fn(),
};

/** A procedure's mutation options as tRPC builds them: the caller's own, and its send. */
const procedure = (mutationFn: (input: unknown) => unknown) => ({
  mutationOptions: (options?: object) => ({ ...options, mutationFn }),
});

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    groceries: {
      list: {
        queryKey: () => ["groceries", "list"],
        queryOptions: () => ({
          queryKey: ["groceries", "list"],
          queryFn: async () => createMockGroceriesData(),
        }),
      },
      create: procedure(_mockMutations.create),
      toggle: procedure(_mockMutations.toggle),
      update: procedure(_mockMutations.update),
      delete: procedure(_mockMutations.delete),
      createRecurring: procedure(_mockMutations.createRecurring),
      updateRecurring: procedure(_mockMutations.updateRecurring),
      deleteRecurring: procedure(_mockMutations.deleteRecurring),
      detachRecurring: procedure(_mockMutations.detachRecurring),
      checkRecurring: procedure(_mockMutations.checkRecurring),
      markAllDone: procedure(_mockMutations.markAllDone),
      deleteDone: procedure(_mockMutations.deleteDone),
      assignToStore: procedure(_mockMutations.assignToStore),
      reorderInStore: procedure(_mockMutations.reorderInStore),
    },
    config: {
      units: {
        queryKey: () => ["config", "units"],
        queryOptions: () => ({
          queryKey: ["config", "units"],
          queryFn: async () => ({
            volumeUnits: [
              { name: "ml", aliases: ["milliliter"], type: "volume", metricEquivalent: 1 },
              { name: "l", aliases: ["liter"], type: "volume", metricEquivalent: 1000 },
              { name: "cup", aliases: ["cups"], type: "volume", metricEquivalent: 236.588 },
            ],
            weightUnits: [
              { name: "g", aliases: ["gram"], type: "weight", metricEquivalent: 1 },
              { name: "kg", aliases: ["kilogram"], type: "weight", metricEquivalent: 1000 },
            ],
            defaultUnit: "piece",
          }),
        }),
      },
    },
  }),
}));

vi.mock("../../config", () => ({
  useUnitsQuery: () => ({
    units: {
      volumeUnits: [
        { name: "ml", aliases: ["milliliter"], type: "volume", metricEquivalent: 1 },
        { name: "l", aliases: ["liter"], type: "volume", metricEquivalent: 1000 },
        { name: "cup", aliases: ["cups"], type: "volume", metricEquivalent: 236.588 },
      ],
      weightUnits: [
        { name: "g", aliases: ["gram"], type: "weight", metricEquivalent: 1 },
        { name: "kg", aliases: ["kilogram"], type: "weight", metricEquivalent: 1000 },
      ],
      defaultUnit: "piece",
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@norish/shared/lib/helpers", () => ({
  parseIngredientWithDefaults: vi.fn((raw: string) => [
    {
      description: raw.trim().replace(/^\d+(?:\.\d+)?\s+\S+\s+/u, ""),
      quantity: 1,
      unitOfMeasure: "piece",
    },
  ]),
}));

vi.mock("@norish/shared/lib/recurrence/calculator", () => ({
  calculateNextOccurrence: vi.fn(() => "2025-01-22"),
  getTodayString: vi.fn(() => "2025-01-15"),
}));

describe("useGroceriesMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let adapter: PlatformAdapter;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    adapter = fakePlatformAdapter();
    for (const send of Object.values(_mockMutations)) send.mockReset();
    // The server keeps what it was sent, under the ids it was sent with.
    _mockMutations.create.mockImplementation(async (rows: Array<{ id: string }>) => ({
      ids: rows.map((row) => row.id),
    }));
  });

  /** Answers the next send of a procedure when the test says, the way a slow server does. */
  const answerLater = (send: (typeof _mockMutations)[keyof typeof _mockMutations]) => {
    const answer = Promise.withResolvers<unknown>();

    send.mockImplementationOnce(() => answer.promise);

    return answer;
  };
  /** Every send answered and every answer handled. */
  const settled = () =>
    act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });
  const list = () =>
    queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>(["groceries", "list"]);

  describe("module structure", () => {
    it("exports all expected mutation functions", async () => {
      // Set up initial data in cache
      const initialData = createMockGroceriesData(
        [createMockGrocery({ id: "g1", name: "Milk" })],
        [createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" })]
      );

      queryClient.setQueryData(["groceries", "list"], initialData);

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      // Verify all expected functions are exported
      expect(result.current).toHaveProperty("createGrocery");
      expect(result.current).toHaveProperty("createRecurringGrocery");
      expect(result.current).toHaveProperty("toggleGroceries");
      expect(result.current).toHaveProperty("toggleRecurringGrocery");
      expect(result.current).toHaveProperty("updateGrocery");
      expect(result.current).toHaveProperty("updateRecurringGrocery");
      expect(result.current).toHaveProperty("deleteGroceries");
      expect(result.current).toHaveProperty("deleteRecurringGrocery");

      // Verify they are functions
      expect(typeof result.current.createGrocery).toBe("function");
      expect(typeof result.current.createRecurringGrocery).toBe("function");
      expect(typeof result.current.toggleGroceries).toBe("function");
      expect(typeof result.current.toggleRecurringGrocery).toBe("function");
      expect(typeof result.current.updateGrocery).toBe("function");
      expect(typeof result.current.updateRecurringGrocery).toBe("function");
      expect(typeof result.current.deleteGroceries).toBe("function");
      expect(typeof result.current.deleteRecurringGrocery).toBe("function");
    });

    it("adds created groceries to the cache optimistically", async () => {
      const initialData = createMockGroceriesData(
        [createMockGrocery({ id: "existing", name: "Milk", storeId: "store-1", sortOrder: 0 })],
        []
      );

      queryClient.setQueryData(["groceries", "list"], initialData);

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      act(() => {
        result.current.createGrocery("1 piece Apples", "store-1");
      });

      const data = queryClient.getQueryData<ReturnType<typeof createMockGroceriesData>>([
        "groceries",
        "list",
      ]);

      expect(data?.groceries[0]).toMatchObject({
        name: "Apples",
        amount: 1,
        unit: "piece",
        isDone: false,
        storeId: "store-1",
        sortOrder: 0,
      });
      expect(data?.groceries[1]).toMatchObject({
        id: "existing",
        sortOrder: 1,
      });
    });

    it("keeps the sort order and version the answer gives a row the new one moved down", async () => {
      queryClient.setQueryData(
        ["groceries", "list"],
        createMockGroceriesData(
          [createMockGrocery({ id: "milk", storeId: "store-1", sortOrder: 0, version: 1 })],
          []
        )
      );

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      _mockMutations.create.mockImplementationOnce(async ([sent]: Array<{ id: string }>) => {
        const apples = createMockGrocery({ id: sent!.id, storeId: "store-1", sortOrder: 0 });
        const milk = createMockGrocery({
          id: "milk",
          storeId: "store-1",
          sortOrder: 1,
          version: 2,
        });

        return {
          ids: [apples.id],
          createdGroceries: [apples],
          updatedGroceries: [milk],
          returnedGroceries: [apples],
        };
      });
      act(() => result.current.createGrocery("1 piece Apples", "store-1"));
      await settled();

      expect(list()?.groceries.find((grocery) => grocery.id === "milk")).toMatchObject({
        sortOrder: 1,
        version: 2,
      });
    });

    it("puts every grocery a typed name became on the list, in place of the one typed", async () => {
      queryClient.setQueryData(
        ["groceries", "list"],
        createMockGroceriesData([createMockGrocery({ id: "existing", name: "Milk" })], [])
      );

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      _mockMutations.create.mockImplementationOnce(async ([sent]: Array<{ id: string }>) => {
        const zout = createMockGrocery({ id: sent!.id, name: "zout" });
        const peper = createMockGrocery({ id: "peper", name: "peper" });

        return {
          ids: [zout.id, peper.id],
          createdGroceries: [zout, peper],
          updatedGroceries: [],
          returnedGroceries: [zout, peper],
        };
      });
      act(() => result.current.createGrocery("zout en peper"));
      await settled();

      const data = list();

      expect(data?.groceries.map((grocery) => grocery.name).sort()).toEqual([
        "Milk",
        "peper",
        "zout",
      ]);
    });

    it("removes an optimistic grocery and reports a failed Outbox admission", async () => {
      queryClient.setQueryData(
        ["groceries", "list"],
        createMockGroceriesData([createMockGrocery({ id: "existing", name: "Milk" })], [])
      );

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });
      const admissionError = new TypeError("Failed to fetch");

      markOutboxAdmissionFailed(admissionError);
      expect(isQueuedOutboxSignal(admissionError)).toBe(false);
      _mockMutations.create.mockRejectedValueOnce(admissionError);
      act(() => result.current.createGrocery("Apples"));
      await settled();

      expect(adapter.showError).toHaveBeenCalledWith(
        "The grocery change was not saved. Please try again.",
        "groceries-mutations"
      );
      expect(list()?.groceries.map((grocery) => grocery.id)).toEqual(["existing"]);
    });

    it("rolls back a grocery check-off and reports a failed Outbox admission", async () => {
      queryClient.setQueryData(
        ["groceries", "list"],
        createMockGroceriesData([createMockGrocery({ id: "g1", isDone: false, version: 3 })], [])
      );

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });
      const admissionError = new TypeError("Failed to fetch");

      markOutboxAdmissionFailed(admissionError);
      _mockMutations.toggle.mockRejectedValueOnce(admissionError);
      act(() => result.current.toggleGroceries(["g1"], true));
      await settled();

      expect(adapter.showError).toHaveBeenCalledWith(
        "The grocery change was not saved. Please try again.",
        "groceries-mutations"
      );
      expect(list()?.groceries[0]).toMatchObject({ id: "g1", isDone: false, version: 3 });
    });

    it("rolls back two saves that overlap and both fail, in the order they were sent", async () => {
      const before = createMockGroceriesData(
        [
          createMockGrocery({ id: "g1", name: "Milk", version: 3 }),
          createMockGrocery({ id: "g2", name: "Bread", version: 5 }),
        ],
        []
      );

      queryClient.setQueryData(["groceries", "list"], before);
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });
      const first = answerLater(_mockMutations.update);
      const second = answerLater(_mockMutations.update);

      act(() => result.current.updateGrocery("g1", "Oat milk"));
      act(() => result.current.updateGrocery("g2", "Rye bread"));
      expect(list()?.groceries.map((grocery) => grocery.name)).toEqual(["Oat milk", "Rye bread"]);

      await act(async () => first.reject(new Error("Version conflict")));
      await act(async () => second.reject(new Error("Version conflict")));
      await settled();

      expect(list()?.groceries).toEqual(before.groceries);
      expect(adapter.showError).toHaveBeenCalledTimes(2);
    });
  });

  describe("a list read already under way", () => {
    it("does not land over a grocery checked off while it ran", async () => {
      const before = createMockGroceriesData(
        [createMockGrocery({ id: "g1", isDone: false, version: 3 })],
        []
      );
      let answerRead: (data: typeof before) => void = () => {};

      // Fresh, so mounting reads nothing of its own.
      queryClient.setQueryDefaults(["groceries", "list"], { staleTime: Infinity });
      queryClient.setQueryData(["groceries", "list"], before);

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });
      // The page's own read, answered with the list as it was before the tick.
      const read = queryClient
        .query({
          queryKey: ["groceries", "list"],
          queryFn: () => new Promise<typeof before>((resolve) => (answerRead = resolve)),
          staleTime: 0,
        })
        .catch(() => undefined);

      act(() => result.current.toggleGroceries(["g1"], true));
      answerRead(before);
      await read;

      const data = queryClient.getQueryData<typeof before>(["groceries", "list"]);

      expect(data?.groceries[0]).toMatchObject({ id: "g1", isDone: true, version: 4 });
    });

    it("keeps a list restored while it waited, as an offline load restores it", () => {
      const restored = createMockGroceriesData(
        [createMockGrocery({ id: "g1", isDone: false, version: 3 })],
        []
      );

      queryClient.setQueryDefaults(["groceries", "list"], { staleTime: Infinity });
      // The read starts before the stored list is restored, and waits.
      void queryClient
        .query({
          queryKey: ["groceries", "list"],
          queryFn: () => new Promise<typeof restored>(() => {}),
          staleTime: 0,
        })
        .catch(() => undefined);
      // The stored copy, restored the way the persister restores it.
      const stored = createTestQueryClient();

      stored.setQueryData(["groceries", "list"], restored);
      hydrate(queryClient, dehydrate(stored));
      expect(queryClient.getQueryData(["groceries", "list"])).toEqual(restored);

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      act(() => result.current.toggleGroceries(["g1"], true));

      const data = queryClient.getQueryData<typeof restored>(["groceries", "list"]);

      expect(data?.groceries[0]).toMatchObject({ id: "g1", isDone: true, version: 4 });
    });
  });

  describe("a component that only acts", () => {
    it("does not re-render when the list changes, and acts on the list as it is then", async () => {
      queryClient.setQueryData(
        ["groceries", "list"],
        createMockGroceriesData([createMockGrocery({ id: "g1", version: 2 })], [])
      );
      let renders = 0;
      const { result } = renderHook(
        () => {
          renders += 1;

          return useGroceriesMutations();
        },
        { wrapper: createTestWrapper(queryClient, adapter) }
      );
      const before = renders;

      // A housemate's change lands; the cache tells its observers on the next tick.
      await act(async () => {
        queryClient.setQueryData(
          ["groceries", "list"],
          createMockGroceriesData([createMockGrocery({ id: "g1", version: 3 })], [])
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(renders).toBe(before);

      await act(async () => result.current.deleteGroceries(["g1"]));

      expect(_mockMutations.delete).toHaveBeenLastCalledWith(
        { groceries: [{ id: "g1", version: 3 }] },
        expect.any(Object)
      );
    });
  });

  describe("versioned mutation inputs", () => {
    it("passes the current grocery version on update", async () => {
      const grocery = createMockGrocery({ id: "g1", version: 4, name: "Milk" });

      queryClient.setQueryData(["groceries", "list"], createMockGroceriesData([grocery], []));

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      await act(async () => result.current.updateGrocery("g1", "Oat milk"));

      expect(_mockMutations.update).toHaveBeenCalledWith(
        { groceryId: "g1", raw: "Oat milk", version: 4 },
        expect.any(Object)
      );
    });

    it("passes grocery versions on delete", async () => {
      const groceries = [
        createMockGrocery({ id: "g1", version: 2 }),
        createMockGrocery({ id: "g2", version: 5 }),
      ];

      queryClient.setQueryData(["groceries", "list"], createMockGroceriesData(groceries, []));

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      await act(async () => result.current.deleteGroceries(["g1", "g2"]));

      expect(_mockMutations.delete).toHaveBeenCalledWith(
        {
          groceries: [
            { id: "g1", version: 2 },
            { id: "g2", version: 5 },
          ],
        },
        expect.any(Object)
      );
    });

    it("passes grocery and recurring versions when toggling a recurring grocery", async () => {
      const grocery = createMockGrocery({ id: "g1", version: 3, recurringGroceryId: "r1" });
      const recurring = createMockRecurringGrocery({ id: "r1", version: 7 });

      queryClient.setQueryData(
        ["groceries", "list"],
        createMockGroceriesData([grocery], [recurring])
      );

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      await act(async () => result.current.toggleRecurringGrocery("r1", "g1", true));

      expect(_mockMutations.checkRecurring).toHaveBeenCalledWith(
        {
          recurringGroceryId: "r1",
          recurringVersion: 7,
          groceryId: "g1",
          groceryVersion: 3,
          isDone: true,
        },
        expect.any(Object)
      );
    });

    it("sends an id/version snapshot when marking all groceries done in a store", async () => {
      const groceries = [
        createMockGrocery({ id: "g1", version: 2, storeId: "store-1", isDone: false }),
        createMockGrocery({ id: "g2", version: 5, storeId: "store-1", isDone: false }),
        createMockGrocery({ id: "g3", version: 8, storeId: "store-1", isDone: true }),
      ];

      queryClient.setQueryData(["groceries", "list"], createMockGroceriesData(groceries, []));

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      await act(async () => result.current.markAllDoneInStore("store-1"));

      expect(_mockMutations.markAllDone).toHaveBeenCalledWith(
        {
          storeId: "store-1",
          groceries: [
            { id: "g1", version: 2 },
            { id: "g2", version: 5 },
          ],
        },
        expect.any(Object)
      );
    });

    it("sends an id/version snapshot when deleting done groceries in a store", async () => {
      const groceries = [
        createMockGrocery({ id: "g1", version: 2, storeId: "store-1", isDone: true }),
        createMockGrocery({ id: "g2", version: 5, storeId: "store-1", isDone: true }),
        createMockGrocery({ id: "g3", version: 8, storeId: "store-1", isDone: false }),
      ];

      queryClient.setQueryData(["groceries", "list"], createMockGroceriesData(groceries, []));

      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient, adapter),
      });

      await act(async () => result.current.deleteDoneInStore("store-1"));

      expect(_mockMutations.deleteDone).toHaveBeenCalledWith(
        {
          storeId: "store-1",
          groceries: [
            { id: "g1", version: 2 },
            { id: "g2", version: 5 },
          ],
        },
        expect.any(Object)
      );
    });
  });
});
