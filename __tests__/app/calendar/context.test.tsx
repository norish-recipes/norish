import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// Mock the calendar hooks
const mockCalendarData = {};
const mockIsLoading = false;

vi.mock("@/hooks/calendar", () => ({
  useCalendarQuery: vi.fn(() => ({
    calendarData: mockCalendarData,
    isLoading: mockIsLoading,
  })),
  useCalendarMutations: vi.fn(() => ({
    createItem: vi.fn(),
    deleteItem: vi.fn(),
    moveItem: vi.fn(),
    updateItem: vi.fn(),
  })),
  useCalendarSubscription: vi.fn(),
}));

import { CalendarContextProvider, useCalendarContext } from "@/app/(app)/calendar/context";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createTestWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <CalendarContextProvider>{children}</CalendarContextProvider>
      </QueryClientProvider>
    );
  };
}

describe("CalendarContext", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("provides initial date range for mobile mode (±2 weeks)", () => {
      const { result } = renderHook(() => useCalendarContext(), {
        wrapper: createTestWrapper(queryClient),
      });

      const now = new Date();
      const { dateRange } = result.current;

      // Should be approximately 2 weeks before and after today
      const daysDiff = Math.round(
        (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
      );

      // ±2 weeks = ~28-35 days (depends on week boundaries)
      expect(daysDiff).toBeGreaterThanOrEqual(28);
      expect(daysDiff).toBeLessThanOrEqual(42);

      // Start should be before today
      expect(dateRange.start.getTime()).toBeLessThan(now.getTime());
      // End should be after today
      expect(dateRange.end.getTime()).toBeGreaterThan(now.getTime());
    });

    it("exposes isLoading state", () => {
      const { result } = renderHook(() => useCalendarContext(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("exposes isLoadingMore state", () => {
      const { result } = renderHook(() => useCalendarContext(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoadingMore).toBe(false);
    });
  });

  describe("expandRange", () => {
    it("expands date range into the past", () => {
      const { result } = renderHook(() => useCalendarContext(), {
        wrapper: createTestWrapper(queryClient),
      });

      const initialStart = result.current.dateRange.start.getTime();

      act(() => {
        result.current.expandRange("past");
      });

      // Start date should have moved earlier (2 weeks = 14 days)
      const newStart = result.current.dateRange.start.getTime();
      const daysMoved = Math.round((initialStart - newStart) / (1000 * 60 * 60 * 24));

      expect(daysMoved).toBe(12);
    });

    it("expands date range into the future", () => {
      const { result } = renderHook(() => useCalendarContext(), {
        wrapper: createTestWrapper(queryClient),
      });

      const initialEnd = result.current.dateRange.end.getTime();

      act(() => {
        result.current.expandRange("future");
      });

      // End date should have moved later (2 weeks = 14 days)
      const newEnd = result.current.dateRange.end.getTime();
      const daysMoved = Math.round((newEnd - initialEnd) / (1000 * 60 * 60 * 24));

      expect(daysMoved).toBe(12);
    });
  });

  describe("isDateInRange", () => {
    it("returns true for date within range", () => {
      const { result } = renderHook(() => useCalendarContext(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Today should be in range
      expect(result.current.isDateInRange(new Date())).toBe(true);
    });

    it("returns false for date outside range", () => {
      const { result } = renderHook(() => useCalendarContext(), {
        wrapper: createTestWrapper(queryClient),
      });

      // A date far in the future should be out of range
      const farFuture = new Date();

      farFuture.setFullYear(farFuture.getFullYear() + 1);

      expect(result.current.isDateInRange(farFuture)).toBe(false);
    });
  });

  describe("getItemsForSlot", () => {
    it("returns empty array when no items exist for slot", () => {
      const { result } = renderHook(() => useCalendarContext(), {
        wrapper: createTestWrapper(queryClient),
      });

      const items = result.current.getItemsForSlot("2025-01-15", "Breakfast");

      expect(items).toEqual([]);
    });
  });

  describe("context error handling", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useCalendarContext());
      }).toThrow("useCalendarContext must be used within CalendarContextProvider");

      consoleSpy.mockRestore();
    });
  });
});
