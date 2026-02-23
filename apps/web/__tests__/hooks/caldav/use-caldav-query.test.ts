import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, renderHook, act } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockCaldavConfig,
  createMockSyncStatusView,
  createMockSyncSummary,
  createMockSyncStatusData,
} from "./test-utils";

// Mock the tRPC provider
const mockConfigQueryKey = ["caldav", "getConfig"];
const mockPasswordQueryKey = ["caldav", "getPassword"];
const mockSyncStatusQueryKey = ["caldav", "getSyncStatus"];
const mockSummaryQueryKey = ["caldav", "getSummary"];
const mockConnectionQueryKey = ["caldav", "checkConnection"];

const mockConfigQueryOptions = vi.fn();
const mockPasswordQueryOptions = vi.fn();
const mockSyncStatusQueryOptions = vi.fn();
const mockSummaryQueryOptions = vi.fn();
const mockConnectionQueryOptions = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    caldav: {
      getConfig: {
        queryKey: () => mockConfigQueryKey,
        queryOptions: () => mockConfigQueryOptions(),
      },
      getPassword: {
        queryKey: () => mockPasswordQueryKey,
        queryOptions: (_input: any, options?: any) => ({
          ...mockPasswordQueryOptions(),
          ...options,
        }),
      },
      getSyncStatus: {
        queryKey: (input: any) => [...mockSyncStatusQueryKey, input],
        queryOptions: (input: any) => mockSyncStatusQueryOptions(input),
      },
      getSummary: {
        queryKey: () => mockSummaryQueryKey,
        queryOptions: () => mockSummaryQueryOptions(),
      },
      checkConnection: {
        queryKey: () => mockConnectionQueryKey,
        queryOptions: () => mockConnectionQueryOptions(),
      },
    },
  }),
}));

// Import after mocking
import {
  useCaldavConfigQuery,
  useCaldavPasswordQuery,
  useCaldavSyncStatusQuery,
  useCaldavSummaryQuery,
  useCaldavConnectionQuery,
} from "@/hooks/caldav/use-caldav-query";

describe("CalDAV Query Hooks", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("useCaldavConfigQuery", () => {
    it("returns null when no config exists", async () => {
      mockConfigQueryOptions.mockReturnValue({
        queryKey: mockConfigQueryKey,
        queryFn: async () => null,
      });

      const { result } = renderHook(() => useCaldavConfigQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toBeNull();
    });

    it("returns config when it exists", async () => {
      const mockConfig = createMockCaldavConfig();

      mockConfigQueryOptions.mockReturnValue({
        queryKey: mockConfigQueryKey,
        queryFn: async () => mockConfig,
      });

      const { result } = renderHook(() => useCaldavConfigQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toEqual(mockConfig);
    });

    it("provides setConfig function for cache updates", async () => {
      const initialConfig = createMockCaldavConfig();

      mockConfigQueryOptions.mockReturnValue({
        queryKey: mockConfigQueryKey,
        queryFn: async () => initialConfig,
      });

      const { result } = renderHook(() => useCaldavConfigQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toEqual(initialConfig);

      const newConfig = createMockCaldavConfig({ serverUrl: "https://new.example.com" });

      act(() => {
        result.current.setConfig(() => newConfig);
      });

      await waitFor(() => {
        expect(result.current.config).toEqual(newConfig);
      });
    });

    it("provides invalidate function", async () => {
      mockConfigQueryOptions.mockReturnValue({
        queryKey: mockConfigQueryKey,
        queryFn: async () => null,
      });

      const { result } = renderHook(() => useCaldavConfigQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.invalidate).toBeDefined();
      expect(typeof result.current.invalidate).toBe("function");
    });

    it("returns queryKey for external cache operations", async () => {
      mockConfigQueryOptions.mockReturnValue({
        queryKey: mockConfigQueryKey,
        queryFn: async () => null,
      });

      const { result } = renderHook(() => useCaldavConfigQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.queryKey).toEqual(mockConfigQueryKey);
    });
  });

  describe("useCaldavPasswordQuery", () => {
    it("returns null when no password exists", async () => {
      mockPasswordQueryOptions.mockReturnValue({
        queryKey: mockPasswordQueryKey,
        queryFn: async () => null,
      });

      const { result } = renderHook(() => useCaldavPasswordQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.password).toBeNull();
    });

    it("returns password when it exists", async () => {
      mockPasswordQueryOptions.mockReturnValue({
        queryKey: mockPasswordQueryKey,
        queryFn: async () => "secretpassword",
      });

      const { result } = renderHook(() => useCaldavPasswordQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.password).toBe("secretpassword");
    });
  });

  describe("useCaldavSyncStatusQuery", () => {
    it("returns empty list when no statuses exist", async () => {
      mockSyncStatusQueryOptions.mockReturnValue({
        queryKey: [...mockSyncStatusQueryKey, { page: 1, pageSize: 20 }],
        queryFn: async () => createMockSyncStatusData(),
      });

      const { result } = renderHook(() => useCaldavSyncStatusQuery(1, 20), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.statuses).toEqual([]);
      expect(result.current.total).toBe(0);
    });

    it("returns paginated sync statuses", async () => {
      const mockStatuses = [
        createMockSyncStatusView({ id: "status-1" }),
        createMockSyncStatusView({ id: "status-2" }),
      ];

      mockSyncStatusQueryOptions.mockReturnValue({
        queryKey: [...mockSyncStatusQueryKey, { page: 1, pageSize: 20 }],
        queryFn: async () => createMockSyncStatusData(mockStatuses, 2),
      });

      const { result } = renderHook(() => useCaldavSyncStatusQuery(1, 20), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.statuses).toHaveLength(2);
      expect(result.current.total).toBe(2);
    });

    it("supports status filter parameter", async () => {
      mockSyncStatusQueryOptions.mockReturnValue({
        queryKey: [...mockSyncStatusQueryKey, { page: 1, pageSize: 20, statusFilter: "pending" }],
        queryFn: async () => createMockSyncStatusData(),
      });

      const { result } = renderHook(() => useCaldavSyncStatusQuery(1, 20, "pending"), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSyncStatusQueryOptions).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        statusFilter: "pending",
      });
    });
  });

  describe("useCaldavSummaryQuery", () => {
    it("returns default summary when no data exists", async () => {
      mockSummaryQueryOptions.mockReturnValue({
        queryKey: mockSummaryQueryKey,
        queryFn: async () => createMockSyncSummary(),
      });

      const { result } = renderHook(() => useCaldavSummaryQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summary).toEqual({
        pending: 0,
        synced: 0,
        failed: 0,
        removed: 0,
      });
    });

    it("returns summary with counts", async () => {
      const mockSummary = createMockSyncSummary({
        pending: 5,
        synced: 10,
        failed: 2,
        removed: 1,
      });

      mockSummaryQueryOptions.mockReturnValue({
        queryKey: mockSummaryQueryKey,
        queryFn: async () => mockSummary,
      });

      const { result } = renderHook(() => useCaldavSummaryQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summary).toEqual(mockSummary);
    });
  });

  describe("useCaldavConnectionQuery", () => {
    it("returns disconnected state when not connected", async () => {
      mockConnectionQueryOptions.mockReturnValue({
        queryKey: mockConnectionQueryKey,
        queryFn: async () => ({ success: false, message: "Not configured" }),
      });

      const { result } = renderHook(() => useCaldavConnectionQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.message).toBe("Not configured");
    });

    it("returns connected state when connected", async () => {
      mockConnectionQueryOptions.mockReturnValue({
        queryKey: mockConnectionQueryKey,
        queryFn: async () => ({ success: true, message: "Connected" }),
      });

      const { result } = renderHook(() => useCaldavConnectionQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.message).toBe("Connected");
    });
  });
});
