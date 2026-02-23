import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor, renderHook, act } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper, createMockCaldavConfig } from "./test-utils";

// Mock query keys
const mockConfigQueryKey = ["caldav", "getConfig"];
const mockSyncStatusQueryKey = ["caldav", "getSyncStatus"];
const mockSummaryQueryKey = ["caldav", "getSummary"];

// Mock mutation functions
const mockSaveConfigMutate = vi.fn();
const mockTestConnectionMutate = vi.fn();
const mockFetchCalendarsMutate = vi.fn();
const mockDeleteConfigMutate = vi.fn();
const mockTriggerSyncMutate = vi.fn();
const mockSyncAllMutate = vi.fn();
const mockGetConfigQueryFn = vi.fn();
const mockGetSyncStatusQueryFn = vi.fn();
const mockGetSummaryQueryFn = vi.fn();

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    caldav: {
      getConfig: {
        queryKey: () => mockConfigQueryKey,
        queryOptions: () => ({
          queryKey: mockConfigQueryKey,
          queryFn: mockGetConfigQueryFn,
        }),
      },
      getSyncStatus: {
        queryKey: (input: any) => [...mockSyncStatusQueryKey, input],
        queryOptions: (input: any) => ({
          queryKey: [...mockSyncStatusQueryKey, input],
          queryFn: () => mockGetSyncStatusQueryFn(input),
        }),
      },
      getSummary: {
        queryKey: () => mockSummaryQueryKey,
        queryOptions: () => ({
          queryKey: mockSummaryQueryKey,
          queryFn: mockGetSummaryQueryFn,
        }),
      },
      saveConfig: {
        mutationOptions: () => ({
          mutationFn: mockSaveConfigMutate,
        }),
      },
      testConnection: {
        mutationOptions: () => ({
          mutationFn: mockTestConnectionMutate,
        }),
      },
      fetchCalendars: {
        mutationOptions: () => ({
          mutationFn: mockFetchCalendarsMutate,
        }),
      },
      deleteConfig: {
        mutationOptions: () => ({
          mutationFn: mockDeleteConfigMutate,
        }),
      },
      triggerSync: {
        mutationOptions: () => ({
          mutationFn: mockTriggerSyncMutate,
        }),
      },
      syncAll: {
        mutationOptions: () => ({
          mutationFn: mockSyncAllMutate,
        }),
      },
    },
  }),
}));

// Import after mocking
import { useCaldavMutations } from "@/hooks/caldav/use-caldav-mutations";

describe("CalDAV Mutation Hooks", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    // Default mock returns
    mockGetConfigQueryFn.mockResolvedValue(null);
    mockGetSyncStatusQueryFn.mockResolvedValue({ statuses: [], total: 0, page: 1, pageSize: 20 });
    mockGetSummaryQueryFn.mockResolvedValue({ pending: 0, synced: 0, failed: 0, removed: 0 });
  });

  describe("useCaldavMutations.saveConfig", () => {
    it("calls saveConfig mutation with correct data", async () => {
      const configInput = {
        serverUrl: "https://caldav.example.com",
        username: "testuser",
        password: "testpass",
        enabled: true,
        breakfastTime: "08:00-09:00",
        lunchTime: "12:00-13:00",
        dinnerTime: "18:00-19:00",
        snackTime: "15:00-15:30",
      };

      const mockResultConfig = createMockCaldavConfig(configInput);

      mockSaveConfigMutate.mockResolvedValueOnce(mockResultConfig);

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveConfig(configInput);
      });

      expect(mockSaveConfigMutate).toHaveBeenCalledWith(configInput, expect.anything());
    });

    it("returns saved config on success", async () => {
      const configInput = {
        serverUrl: "https://caldav.example.com",
        username: "testuser",
        password: "testpass",
        enabled: true,
        breakfastTime: "08:00-09:00",
        lunchTime: "12:00-13:00",
        dinnerTime: "18:00-19:00",
        snackTime: "15:00-15:30",
      };

      const mockResultConfig = createMockCaldavConfig(configInput);

      mockSaveConfigMutate.mockResolvedValueOnce(mockResultConfig);

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      let savedConfig: any;

      await act(async () => {
        savedConfig = await result.current.saveConfig(configInput);
      });

      expect(savedConfig.serverUrl).toBe(configInput.serverUrl);
      expect(savedConfig.username).toBe(configInput.username);
    });
  });

  describe("useCaldavMutations.testConnection", () => {
    it("calls testConnection mutation with correct data", async () => {
      const connectionInput = {
        serverUrl: "https://caldav.example.com",
        username: "testuser",
        password: "testpass",
      };

      mockTestConnectionMutate.mockResolvedValueOnce({
        success: true,
        message: "Connection successful",
      });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.testConnection(connectionInput);
      });

      expect(mockTestConnectionMutate).toHaveBeenCalledWith(connectionInput, expect.anything());
    });

    it("returns success result on successful connection", async () => {
      mockTestConnectionMutate.mockResolvedValueOnce({
        success: true,
        message: "Connection successful",
      });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      let response: any;

      await act(async () => {
        response = await result.current.testConnection({
          serverUrl: "https://caldav.example.com",
          username: "testuser",
          password: "testpass",
        });
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe("Connection successful");
    });

    it("handles connection failure", async () => {
      mockTestConnectionMutate.mockResolvedValueOnce({
        success: false,
        message: "Invalid credentials",
      });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      let response: any;

      await act(async () => {
        response = await result.current.testConnection({
          serverUrl: "https://caldav.example.com",
          username: "testuser",
          password: "wrongpass",
        });
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe("Invalid credentials");
    });
  });

  describe("useCaldavMutations.deleteConfig", () => {
    it("calls deleteConfig mutation", async () => {
      mockDeleteConfigMutate.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.deleteConfig();
      });

      expect(mockDeleteConfigMutate).toHaveBeenCalledWith(
        { deleteEvents: false },
        expect.anything()
      );
    });

    it("calls deleteConfig mutation with deleteEvents flag", async () => {
      mockDeleteConfigMutate.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.deleteConfig(true);
      });

      expect(mockDeleteConfigMutate).toHaveBeenCalledWith(
        { deleteEvents: true },
        expect.anything()
      );
    });
  });

  describe("useCaldavMutations.triggerSync", () => {
    it("calls triggerSync mutation", async () => {
      mockTriggerSyncMutate.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.triggerSync();
      });

      expect(mockTriggerSyncMutate).toHaveBeenCalled();
    });
  });

  describe("useCaldavMutations.syncAll", () => {
    it("calls syncAll mutation", async () => {
      mockSyncAllMutate.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.syncAll();
      });

      expect(mockSyncAllMutate).toHaveBeenCalled();
    });
  });

  describe("useCaldavMutations loading states", () => {
    it("tracks isSavingConfig loading state", async () => {
      mockSaveConfigMutate.mockResolvedValueOnce(createMockCaldavConfig());

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Before mutation
      expect(result.current.isSavingConfig).toBe(false);

      // Trigger mutation and let it complete
      await act(async () => {
        await result.current.saveConfig({
          serverUrl: "https://caldav.example.com",
          username: "testuser",
          password: "testpass",
          enabled: true,
          breakfastTime: "08:00-09:00",
          lunchTime: "12:00-13:00",
          dinnerTime: "18:00-19:00",
          snackTime: "15:00-15:30",
        });
      });

      // After mutation completes
      await waitFor(() => {
        expect(result.current.isSavingConfig).toBe(false);
      });
    });

    it("tracks isTestingConnection loading state", async () => {
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isTestingConnection).toBe(false);
    });

    it("tracks isDeletingConfig loading state", async () => {
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isDeletingConfig).toBe(false);
    });

    it("tracks isTriggeringSync loading state", async () => {
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isTriggeringSync).toBe(false);
    });

    it("tracks isFetchingCalendars loading state", async () => {
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isFetchingCalendars).toBe(false);
    });

    it("tracks isSyncingAll loading state", async () => {
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isSyncingAll).toBe(false);
    });
  });

  describe("useCaldavMutations.fetchCalendars", () => {
    it("calls fetchCalendars mutation with correct data", async () => {
      const fetchInput = {
        serverUrl: "https://caldav.example.com",
        username: "testuser",
        password: "testpass",
      };

      mockFetchCalendarsMutate.mockResolvedValueOnce([
        { url: "https://caldav.example.com/cal/", displayName: "Default Calendar" },
      ]);

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.fetchCalendars(fetchInput);
      });

      expect(mockFetchCalendarsMutate).toHaveBeenCalledWith(fetchInput, expect.anything());
    });

    it("returns calendar list on success", async () => {
      const mockCalendars = [
        { url: "https://caldav.example.com/cal/default/", displayName: "Default Calendar" },
        { url: "https://caldav.example.com/cal/meals/", displayName: "Meals" },
      ];

      mockFetchCalendarsMutate.mockResolvedValueOnce(mockCalendars);

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      let calendars: any;

      await act(async () => {
        calendars = await result.current.fetchCalendars({
          serverUrl: "https://caldav.example.com",
          username: "testuser",
          password: "testpass",
        });
      });

      expect(calendars).toHaveLength(2);
      expect(calendars[0].displayName).toBe("Default Calendar");
    });
  });
});
