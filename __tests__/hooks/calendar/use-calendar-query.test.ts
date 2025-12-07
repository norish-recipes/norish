import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockPlannedRecipe,
  createMockNote,
} from "./test-utils";

// Mock the tRPC provider
const mockRecipesQueryKey = [
  "calendar",
  "listRecipes",
  { startISO: "2025-01-01", endISO: "2025-01-31" },
];
const mockNotesQueryKey = [
  "calendar",
  "listNotes",
  { startISO: "2025-01-01", endISO: "2025-01-31" },
];
const mockRecipesQueryOptions = vi.fn();
const mockNotesQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    calendar: {
      listRecipes: {
        queryKey: () => mockRecipesQueryKey,
        queryOptions: () => mockRecipesQueryOptions(),
      },
      listNotes: {
        queryKey: () => mockNotesQueryKey,
        queryOptions: () => mockNotesQueryOptions(),
      },
    },
  }),
}));

// Import after mocking
import { useCalendarQuery } from "@/hooks/calendar/use-calendar-query";

describe("useCalendarQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("returns empty calendar data when no data is loaded", () => {
      mockRecipesQueryOptions.mockReturnValue({
        queryKey: mockRecipesQueryKey,
        queryFn: async () => [],
      });
      mockNotesQueryOptions.mockReturnValue({
        queryKey: mockNotesQueryKey,
        queryFn: async () => [],
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useCalendarQuery("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.calendarData).toEqual({});
      expect(result.current.recipesQueryKey).toEqual(mockRecipesQueryKey);
      expect(result.current.notesQueryKey).toEqual(mockNotesQueryKey);
    });

    it("returns loading state initially", () => {
      mockRecipesQueryOptions.mockReturnValue({
        queryKey: mockRecipesQueryKey,
        queryFn: () => new Promise(() => { }), // Never resolves
      });
      mockNotesQueryOptions.mockReturnValue({
        queryKey: mockNotesQueryKey,
        queryFn: () => new Promise(() => { }), // Never resolves
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useCalendarQuery("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns combined calendar data after successful fetch", async () => {
      const mockRecipes = [
        createMockPlannedRecipe({ id: "pr1", date: "2025-01-15", recipeName: "Pancakes" }),
        createMockPlannedRecipe({ id: "pr2", date: "2025-01-15", recipeName: "Salad" }),
        createMockPlannedRecipe({ id: "pr3", date: "2025-01-16", recipeName: "Dinner" }),
      ];
      const mockNotes = [
        createMockNote({ id: "n1", date: "2025-01-15", title: "Meal prep" }),
        createMockNote({ id: "n2", date: "2025-01-17", title: "Grocery shopping" }),
      ];

      mockRecipesQueryOptions.mockReturnValue({
        queryKey: mockRecipesQueryKey,
        queryFn: async () => mockRecipes,
      });
      mockNotesQueryOptions.mockReturnValue({
        queryKey: mockNotesQueryKey,
        queryFn: async () => mockNotes,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useCalendarQuery("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check that data is grouped by date
      expect(Object.keys(result.current.calendarData)).toContain("2025-01-15");
      expect(Object.keys(result.current.calendarData)).toContain("2025-01-16");
      expect(Object.keys(result.current.calendarData)).toContain("2025-01-17");

      // Check date 2025-01-15 has both recipes and notes
      const jan15Items = result.current.calendarData["2025-01-15"];

      expect(jan15Items.length).toBe(3); // 2 recipes + 1 note

      // Check item types
      const recipeItems = jan15Items.filter((i: { itemType: string }) => i.itemType === "recipe");
      const noteItems = jan15Items.filter((i: { itemType: string }) => i.itemType === "note");

      expect(recipeItems.length).toBe(2);
      expect(noteItems.length).toBe(1);
    });

    it("returns empty calendar data when no items exist", async () => {
      mockRecipesQueryOptions.mockReturnValue({
        queryKey: mockRecipesQueryKey,
        queryFn: async () => [],
      });
      mockNotesQueryOptions.mockReturnValue({
        queryKey: mockNotesQueryKey,
        queryFn: async () => [],
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useCalendarQuery("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.calendarData).toEqual({});
    });

    it("handles recipes with null recipeName", async () => {
      const mockRecipes = [
        createMockPlannedRecipe({ id: "pr1", date: "2025-01-15", recipeName: null as any }),
      ];

      mockRecipesQueryOptions.mockReturnValue({
        queryKey: mockRecipesQueryKey,
        queryFn: async () => mockRecipes,
      });
      mockNotesQueryOptions.mockReturnValue({
        queryKey: mockNotesQueryKey,
        queryFn: async () => [],
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useCalendarQuery("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const item = result.current.calendarData["2025-01-15"][0];

      expect(item.itemType).toBe("recipe");

      if (item.itemType === "recipe") {
        expect(item.recipeName).toBe("Unknown");
      }
    });
  });

  describe("setCalendarData", () => {
    it("provides setCalendarData function for optimistic updates", async () => {
      mockRecipesQueryOptions.mockReturnValue({
        queryKey: mockRecipesQueryKey,
        queryFn: async () => [],
      });
      mockNotesQueryOptions.mockReturnValue({
        queryKey: mockNotesQueryKey,
        queryFn: async () => [],
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useCalendarQuery("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.setCalendarData).toBe("function");
    });
  });

  describe("invalidate", () => {
    it("provides invalidate function", async () => {
      mockRecipesQueryOptions.mockReturnValue({
        queryKey: mockRecipesQueryKey,
        queryFn: async () => [],
      });
      mockNotesQueryOptions.mockReturnValue({
        queryKey: mockNotesQueryKey,
        queryFn: async () => [],
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useCalendarQuery("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(typeof result.current.invalidate).toBe("function");
    });
  });
});
