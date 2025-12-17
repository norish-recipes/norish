import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockUser,
  createMockApiKey,
  createMockUserSettingsData,
} from "./test-utils";

// Mock the tRPC provider
const mockQueryKey = ["user", "get"];
const mockAllergiesQueryKey = ["user", "getAllergies"];
const mockQueryOptions = vi.fn();
const mockAllergiesQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    user: {
      get: {
        queryKey: () => mockQueryKey,
        queryOptions: () => mockQueryOptions(),
      },
      getAllergies: {
        queryKey: () => mockAllergiesQueryKey,
        queryOptions: () => mockAllergiesQueryOptions(),
      },
    },
  }),
}));

// Import after mocking
import { useUserSettingsQuery } from "@/hooks/user/use-user-query";

describe("useUserSettingsQuery", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();

    // Default allergies query to empty list
    mockAllergiesQueryOptions.mockReturnValue({
      queryKey: mockAllergiesQueryKey,
      queryFn: async () => ({ allergies: [] }),
    });
  });

  describe("initial state", () => {
    it("returns null user when no data is loaded", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => undefined,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useUserSettingsQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.user).toBeNull();
      expect(result.current.apiKeys).toEqual([]);
      expect(result.current.allergies).toEqual([]);
      expect(result.current.queryKey).toEqual(mockQueryKey);
      expect(result.current.allergiesQueryKey).toEqual(mockAllergiesQueryKey);
    });

    it("returns loading state initially", () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: () => new Promise(() => {}), // Never resolves
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useUserSettingsQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("data fetching", () => {
    it("returns user data after successful fetch", async () => {
      const mockUser = createMockUser({
        id: "user-123",
        name: "John Doe",
        email: "john@example.com",
      });
      const mockApiKeys = [
        createMockApiKey({ id: "key-1", name: "Key 1" }),
        createMockApiKey({ id: "key-2", name: "Key 2" }),
      ];

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockUserSettingsData(mockUser, mockApiKeys),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useUserSettingsQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.apiKeys).toEqual(mockApiKeys);
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
      const { result } = renderHook(() => useUserSettingsQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.user).toBeNull();
    });
  });

  describe("cache management", () => {
    it("provides setUserSettingsData function", async () => {
      const mockData = createMockUserSettingsData(createMockUser(), [createMockApiKey()]);

      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => mockData,
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useUserSettingsQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.setUserSettingsData).toBe("function");
    });

    it("provides invalidate function", async () => {
      mockQueryOptions.mockReturnValue({
        queryKey: mockQueryKey,
        queryFn: async () => createMockUserSettingsData(),
      });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useUserSettingsQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.invalidate).toBe("function");
    });
  });
});
