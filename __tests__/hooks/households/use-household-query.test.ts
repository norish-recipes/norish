import type { HouseholdData } from "@/hooks/households/use-household-query";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockHouseholdSettings,
  createMockHouseholdData,
} from "./test-utils";

// Mock the tRPC provider
const mockQueryKey = ["households", "get"];
const mockQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    households: {
      get: {
        queryKey: () => mockQueryKey,
        queryOptions: () => mockQueryOptions(),
      },
    },
  }),
}));

// Import after mocking
import { useHouseholdQuery } from "@/hooks/households/use-household-query";

describe("useHouseholdQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("returns null household when no data is loaded", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockHouseholdData(null),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.household).toBeNull();
      expect(result.current.queryKey).toEqual(mockQueryKey);
    });

    it("returns loading state initially", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: () => new Promise(() => {}), // Never resolves
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns household data after successful fetch", async () => {
      const mockHousehold = createMockHouseholdSettings({
        id: "h1",
        name: "Test Household",
      });

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockHouseholdData(mockHousehold, "user-1"),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.household).toEqual(mockHousehold);
      expect(result.current.currentUserId).toBe("user-1");
    });

    it("handles fetch failure gracefully", async () => {
      const testError = new Error("Network error");

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => {
          throw testError;
        },
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 2000 }
      );

      expect(result.current.household).toBeNull();
    });
  });

  describe("setHouseholdData", () => {
    it("updates query cache with new data", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1", name: "Initial" });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => initialData,
      });

      queryClient.setQueryData(mockQueryKey, initialData);

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.household).not.toBeNull();
      });

      const updatedHousehold = createMockHouseholdSettings({ id: "h1", name: "Updated" });

      act(() => {
        result.current.setHouseholdData(() => ({
          household: updatedHousehold,
          currentUserId: "user-1",
        }));
      });

      // Wait for React Query cache update to propagate
      await waitFor(() => {
        expect(result.current.household?.name).toBe("Updated");
      });
    });

    it("can clear household data", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1", name: "Test" });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => initialData,
      });

      queryClient.setQueryData(mockQueryKey, initialData);

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.household).not.toBeNull();
      });

      act(() => {
        result.current.setHouseholdData((prev: HouseholdData | undefined) => ({
          household: null,
          currentUserId: prev?.currentUserId ?? "",
        }));
      });

      // Wait for React Query cache update to propagate
      await waitFor(() => {
        expect(result.current.household).toBeNull();
      });
    });
  });

  describe("invalidate", () => {
    it("invalidates queries correctly", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1", name: "Test" });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => initialData,
      });

      queryClient.setQueryData(mockQueryKey, initialData);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { renderHook, act } = require("@testing-library/react");
      const { result } = renderHook(() => useHouseholdQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => {
        result.current.invalidate();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mockQueryKey });
    });
  });
});
