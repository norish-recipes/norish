import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockGroceriesData,
  createMockGrocery,
  createMockRecurringGrocery,
  createTestQueryClient,
  createTestWrapper,
} from "./test-utils";

// Track mutation calls - kept for future assertions
const _mockMutations = {
  create: vi.fn(),
  toggle: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createRecurring: vi.fn(),
  updateRecurring: vi.fn(),
  deleteRecurring: vi.fn(),
  checkRecurring: vi.fn(),
  assignToStore: vi.fn(),
  reorderInStore: vi.fn(),
  markAllDone: vi.fn(),
  deleteDone: vi.fn(),
};

// Mock the dependencies
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");

  return {
    ...actual,
    useMutation: vi.fn((options: { mutationFn?: (...args: unknown[]) => unknown } | undefined) => {
      return {
        mutate: options?.mutationFn ?? vi.fn(),
        mutateAsync: vi.fn().mockResolvedValue("mock-id"),
        isLoading: false,
        error: null,
      };
    }),
  };
});

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    groceries: {
      list: {
        queryKey: () => ["groceries", "list"],
        queryOptions: () => ({
          queryKey: ["groceries", "list"],
          queryFn: async () => createMockGroceriesData(),
        }),
      },
      create: { mutationOptions: vi.fn() },
      toggle: { mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.toggle })) },
      update: { mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.update })) },
      delete: { mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.delete })) },
      createRecurring: {
        mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.createRecurring })),
      },
      updateRecurring: {
        mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.updateRecurring })),
      },
      deleteRecurring: {
        mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.deleteRecurring })),
      },
      checkRecurring: {
        mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.checkRecurring })),
      },
      markAllDone: { mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.markAllDone })) },
      deleteDone: { mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.deleteDone })) },
      assignToStore: {
        mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.assignToStore })),
      },
      reorderInStore: {
        mutationOptions: vi.fn(() => ({ mutationFn: _mockMutations.reorderInStore })),
      },
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

vi.mock("@/hooks/config", () => ({
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
      description: raw.trim(),
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

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("module structure", () => {
    it("exports all expected mutation functions", async () => {
      // Set up initial data in cache
      const initialData = createMockGroceriesData(
        [createMockGrocery({ id: "g1", name: "Milk" })],
        [createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" })]
      );

      queryClient.setQueryData(["groceries", "list"], initialData);

      // Import and render the hook
      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
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
      expect(result.current).toHaveProperty("getRecurringGroceryForGrocery");

      // Verify they are functions
      expect(typeof result.current.createGrocery).toBe("function");
      expect(typeof result.current.createRecurringGrocery).toBe("function");
      expect(typeof result.current.toggleGroceries).toBe("function");
      expect(typeof result.current.toggleRecurringGrocery).toBe("function");
      expect(typeof result.current.updateGrocery).toBe("function");
      expect(typeof result.current.updateRecurringGrocery).toBe("function");
      expect(typeof result.current.deleteGroceries).toBe("function");
      expect(typeof result.current.deleteRecurringGrocery).toBe("function");
      expect(typeof result.current.getRecurringGroceryForGrocery).toBe("function");
    });
  });

  describe("getRecurringGroceryForGrocery", () => {
    it("returns recurring grocery when grocery has recurringGroceryId", async () => {
      const recurringGrocery = createMockRecurringGrocery({ id: "r1", name: "Weekly Eggs" });
      const grocery = createMockGrocery({ id: "g1", name: "Eggs", recurringGroceryId: "r1" });

      const initialData = createMockGroceriesData([grocery], [recurringGrocery]);

      queryClient.setQueryData(["groceries", "list"], initialData);

      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const found = result.current.getRecurringGroceryForGrocery("g1");

      expect(found).toEqual(recurringGrocery);
    });

    it("returns null when grocery has no recurringGroceryId", async () => {
      const grocery = createMockGrocery({ id: "g1", name: "Milk", recurringGroceryId: null });

      const initialData = createMockGroceriesData([grocery], []);

      queryClient.setQueryData(["groceries", "list"], initialData);

      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const found = result.current.getRecurringGroceryForGrocery("g1");

      expect(found).toBeNull();
    });

    it("returns null when grocery not found", async () => {
      const initialData = createMockGroceriesData([], []);

      queryClient.setQueryData(["groceries", "list"], initialData);

      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const found = result.current.getRecurringGroceryForGrocery("non-existent");

      expect(found).toBeNull();
    });
  });

  describe("versioned mutation inputs", () => {
    it("passes the current grocery version on update", async () => {
      const grocery = createMockGrocery({ id: "g1", version: 4, name: "Milk" });

      queryClient.setQueryData(["groceries", "list"], createMockGroceriesData([grocery], []));

      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      result.current.updateGrocery("g1", "Oat milk");

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

      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      result.current.deleteGroceries(["g1", "g2"]);

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

      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      result.current.toggleRecurringGrocery("r1", "g1", true);

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

      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      result.current.markAllDoneInStore("store-1");

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

      const { useGroceriesMutations } = await import("@/hooks/groceries/use-groceries-mutations");
      const { result } = renderHook(() => useGroceriesMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      result.current.deleteDoneInStore("store-1");

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
