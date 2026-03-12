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
};

// Mock the dependencies
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");

  return {
    ...actual,
    useMutation: vi.fn((_options) => {
      // Return mock mutation based on context
      return {
        mutate: vi.fn(),
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
      toggle: { mutationOptions: vi.fn() },
      update: { mutationOptions: vi.fn() },
      delete: { mutationOptions: vi.fn() },
      createRecurring: { mutationOptions: vi.fn() },
      updateRecurring: { mutationOptions: vi.fn() },
      deleteRecurring: { mutationOptions: vi.fn() },
      checkRecurring: { mutationOptions: vi.fn() },
      markAllDone: { mutationOptions: vi.fn() },
      deleteDone: { mutationOptions: vi.fn() },
      assignToStore: { mutationOptions: vi.fn() },
      reorderInStore: { mutationOptions: vi.fn() },
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
});
