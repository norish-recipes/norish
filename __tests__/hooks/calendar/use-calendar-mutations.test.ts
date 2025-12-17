import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

// Mock mutation functions
const mockCreateRecipeMutate = vi.fn();
const mockDeleteRecipeMutate = vi.fn();
const mockUpdateRecipeDateMutate = vi.fn();
const mockCreateNoteMutate = vi.fn();
const mockDeleteNoteMutate = vi.fn();
const mockUpdateNoteDateMutate = vi.fn();
const mockSetCalendarData = vi.fn();
const mockRemoveRecipeFromCache = vi.fn();
const mockUpdateRecipeInCache = vi.fn();
const mockRemoveNoteFromCache = vi.fn();
const mockUpdateNoteInCache = vi.fn();
const mockInvalidate = vi.fn();

// Mock the tRPC provider
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    calendar: {
      listRecipes: {
        queryKey: () => ["calendar", "listRecipes"],
        queryOptions: () => ({
          queryKey: ["calendar", "listRecipes"],
          queryFn: async () => [],
        }),
      },
      listNotes: {
        queryKey: () => ["calendar", "listNotes"],
        queryOptions: () => ({
          queryKey: ["calendar", "listNotes"],
          queryFn: async () => [],
        }),
      },
      createRecipe: {
        mutationOptions: () => ({
          mutationFn: mockCreateRecipeMutate,
        }),
      },
      deleteRecipe: {
        mutationOptions: () => ({
          mutationFn: mockDeleteRecipeMutate,
        }),
      },
      updateRecipeDate: {
        mutationOptions: () => ({
          mutationFn: mockUpdateRecipeDateMutate,
        }),
      },
      createNote: {
        mutationOptions: () => ({
          mutationFn: mockCreateNoteMutate,
        }),
      },
      deleteNote: {
        mutationOptions: () => ({
          mutationFn: mockDeleteNoteMutate,
        }),
      },
      updateNoteDate: {
        mutationOptions: () => ({
          mutationFn: mockUpdateNoteDateMutate,
        }),
      },
    },
  }),
}));

// Mock the query hook
vi.mock("@/hooks/calendar/use-calendar-query", () => ({
  useCalendarQuery: () => ({
    calendarData: {},
    setCalendarData: mockSetCalendarData,
    removeRecipeFromCache: mockRemoveRecipeFromCache,
    updateRecipeInCache: mockUpdateRecipeInCache,
    removeNoteFromCache: mockRemoveNoteFromCache,
    updateNoteInCache: mockUpdateNoteInCache,
    invalidate: mockInvalidate,
  }),
}));

// Calendar mutations depend on household context (for allergy warnings)
vi.mock("@/context/household-context", () => ({
  useHouseholdContext: () => ({
    household: {
      allergies: [],
    },
  }),
}));

// Import after mocking
import { useCalendarMutations } from "@/hooks/calendar/use-calendar-mutations";

describe("useCalendarMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("createPlannedRecipe", () => {
    it("calls mutation and updates calendar data on success", async () => {
      mockCreateRecipeMutate.mockResolvedValue("new-id");

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.createPlannedRecipe("2025-01-15", "Breakfast", "recipe-123", "Pancakes");
      });

      await waitFor(() => {
        expect(mockCreateRecipeMutate).toHaveBeenCalled();
        expect(mockCreateRecipeMutate.mock.calls[0][0]).toEqual({
          date: "2025-01-15",
          slot: "Breakfast",
          recipeId: "recipe-123",
        });
      });

      await waitFor(() => {
        expect(mockSetCalendarData).toHaveBeenCalled();
      });
    });

    it("calls invalidate on mutation error", async () => {
      mockCreateRecipeMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.createPlannedRecipe("2025-01-15", "Breakfast", "recipe-123", "Pancakes");
      });

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });
  });

  describe("deletePlannedRecipe", () => {
    it("applies optimistic update and calls mutation", async () => {
      mockDeleteRecipeMutate.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.deletePlannedRecipe("pr-123", "2025-01-15");
      });

      // Optimistic update should be called immediately
      expect(mockSetCalendarData).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockDeleteRecipeMutate).toHaveBeenCalled();
        expect(mockDeleteRecipeMutate.mock.calls[0][0]).toEqual({
          id: "pr-123",
          date: "2025-01-15",
        });
      });
    });

    it("calls invalidate on mutation error", async () => {
      mockDeleteRecipeMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.deletePlannedRecipe("pr-123", "2025-01-15");
      });

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });
  });

  describe("updatePlannedRecipeDate", () => {
    it("applies optimistic update and calls mutation", async () => {
      mockUpdateRecipeDateMutate.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.updatePlannedRecipeDate("pr-123", "2025-01-20", "2025-01-15");
      });

      // Optimistic update should be called immediately
      expect(mockSetCalendarData).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockUpdateRecipeDateMutate).toHaveBeenCalled();
        expect(mockUpdateRecipeDateMutate.mock.calls[0][0]).toEqual({
          id: "pr-123",
          newDate: "2025-01-20",
          oldDate: "2025-01-15",
        });
      });
    });

    it("calls invalidate on mutation error", async () => {
      mockUpdateRecipeDateMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.updatePlannedRecipeDate("pr-123", "2025-01-20", "2025-01-15");
      });

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });
  });

  describe("createNote", () => {
    it("calls mutation and updates calendar data on success", async () => {
      mockCreateNoteMutate.mockResolvedValue("new-id");

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.createNote("2025-01-15", "Lunch", "Meal prep");
      });

      await waitFor(() => {
        expect(mockCreateNoteMutate).toHaveBeenCalled();
        expect(mockCreateNoteMutate.mock.calls[0][0]).toEqual({
          date: "2025-01-15",
          slot: "Lunch",
          title: "Meal prep",
        });
      });

      await waitFor(() => {
        expect(mockSetCalendarData).toHaveBeenCalled();
      });
    });

    it("calls invalidate on mutation error", async () => {
      mockCreateNoteMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.createNote("2025-01-15", "Lunch", "Meal prep");
      });

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });
  });

  describe("deleteNote", () => {
    it("applies optimistic update and calls mutation", async () => {
      mockDeleteNoteMutate.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.deleteNote("note-123", "2025-01-15");
      });

      // Optimistic update should be called immediately
      expect(mockSetCalendarData).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockDeleteNoteMutate).toHaveBeenCalled();
        expect(mockDeleteNoteMutate.mock.calls[0][0]).toEqual({
          id: "note-123",
          date: "2025-01-15",
        });
      });
    });

    it("calls invalidate on mutation error", async () => {
      mockDeleteNoteMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.deleteNote("note-123", "2025-01-15");
      });

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });
  });

  describe("updateNoteDate", () => {
    it("applies optimistic update and calls mutation", async () => {
      mockUpdateNoteDateMutate.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.updateNoteDate("note-123", "2025-01-20", "2025-01-15");
      });

      // Optimistic update should be called immediately
      expect(mockSetCalendarData).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockUpdateNoteDateMutate).toHaveBeenCalled();
        expect(mockUpdateNoteDateMutate.mock.calls[0][0]).toEqual({
          id: "note-123",
          newDate: "2025-01-20",
          oldDate: "2025-01-15",
        });
      });
    });

    it("calls invalidate on mutation error", async () => {
      mockUpdateNoteDateMutate.mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCalendarMutations("2025-01-01", "2025-01-31"), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.updateNoteDate("note-123", "2025-01-20", "2025-01-15");
      });

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });
  });
});
