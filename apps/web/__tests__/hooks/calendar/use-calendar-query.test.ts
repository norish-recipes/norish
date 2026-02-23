import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, renderHook } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

type PlannedItemFromQuery = {
  id: string;
  userId: string;
  date: string;
  slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  sortOrder: number;
  itemType: "recipe" | "note";
  recipeId: string | null;
  title: string | null;
  recipeName: string | null;
  recipeImage: string | null;
  servings: number | null;
  calories: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const mockItemsQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    calendar: {
      listItems: {
        queryKey: (input: { startISO: string; endISO: string }) => ["calendar", "listItems", input],
        queryOptions: mockItemsQueryOptions,
      },
    },
  }),
}));

import { useCalendarQuery } from "@/hooks/calendar/use-calendar-query";

function createMockItem(overrides: Partial<PlannedItemFromQuery> = {}): PlannedItemFromQuery {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    userId: "user-1",
    date: "2025-01-15",
    slot: "Breakfast",
    sortOrder: 0,
    itemType: "recipe",
    recipeId: "recipe-123",
    title: null,
    recipeName: "Test Recipe",
    recipeImage: null,
    servings: 4,
    calories: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("useCalendarQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  const startISO = "2025-01-01";
  const endISO = "2025-01-31";

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  function getQueryKey() {
    return ["calendar", "listItems", { startISO, endISO }];
  }

  describe("initial state", () => {
    it("returns empty calendar data when no data is loaded", () => {
      mockItemsQueryOptions.mockReturnValue({
        queryKey: getQueryKey(),
        queryFn: async () => [],
      });

      const { result } = renderHook(() => useCalendarQuery(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.calendarData).toEqual({});
      expect(result.current.items).toEqual([]);
    });

    it("returns loading state initially", () => {
      mockItemsQueryOptions.mockReturnValue({
        queryKey: getQueryKey(),
        queryFn: () => new Promise(() => {}),
      });

      const { result } = renderHook(() => useCalendarQuery(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns calendar data grouped by date after successful fetch", async () => {
      const mockItems = [
        createMockItem({ id: "item-1", date: "2025-01-15", itemType: "recipe", sortOrder: 0 }),
        createMockItem({
          id: "item-2",
          date: "2025-01-15",
          itemType: "note",
          title: "Note",
          sortOrder: 1,
        }),
        createMockItem({ id: "item-3", date: "2025-01-16", itemType: "recipe", sortOrder: 0 }),
      ];

      mockItemsQueryOptions.mockReturnValue({
        queryKey: getQueryKey(),
        queryFn: async () => mockItems,
      });

      const { result } = renderHook(() => useCalendarQuery(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(Object.keys(result.current.calendarData)).toContain("2025-01-15");
      expect(Object.keys(result.current.calendarData)).toContain("2025-01-16");

      const jan15Items = result.current.calendarData["2025-01-15"];

      expect(jan15Items.length).toBe(2);

      const jan16Items = result.current.calendarData["2025-01-16"];

      expect(jan16Items.length).toBe(1);
    });

    it("returns empty calendar data when no items exist", async () => {
      mockItemsQueryOptions.mockReturnValue({
        queryKey: getQueryKey(),
        queryFn: async () => [],
      });

      const { result } = renderHook(() => useCalendarQuery(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.calendarData).toEqual({});
      expect(result.current.items).toEqual([]);
    });

    it("returns items array", async () => {
      const mockItems = [createMockItem({ id: "item-1" }), createMockItem({ id: "item-2" })];

      mockItemsQueryOptions.mockReturnValue({
        queryKey: getQueryKey(),
        queryFn: async () => mockItems,
      });

      const { result } = renderHook(() => useCalendarQuery(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0].id).toBe("item-1");
      expect(result.current.items[1].id).toBe("item-2");
    });
  });

  describe("helper functions", () => {
    it("provides setCalendarData function", () => {
      mockItemsQueryOptions.mockReturnValue({
        queryKey: getQueryKey(),
        queryFn: async () => [],
      });

      const { result } = renderHook(() => useCalendarQuery(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.setCalendarData).toBe("function");
    });

    it("provides invalidate function", () => {
      mockItemsQueryOptions.mockReturnValue({
        queryKey: getQueryKey(),
        queryFn: async () => [],
      });

      const { result } = renderHook(() => useCalendarQuery(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.invalidate).toBe("function");
    });

    it("provides queryKey", () => {
      mockItemsQueryOptions.mockReturnValue({
        queryKey: getQueryKey(),
        queryFn: async () => [],
      });

      const { result } = renderHook(() => useCalendarQuery(startISO, endISO), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.queryKey).toEqual(getQueryKey());
    });
  });
});
