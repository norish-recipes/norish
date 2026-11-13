import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useCaldavMutations } from "../use-caldav-mutations";
import { createMockCaldavConfig } from "./test-utils";

/** What a connection test resolves with. */
type Tested = Awaited<ReturnType<ReturnType<typeof useCaldavMutations>["testConnection"]>>;

// Mock query keys
const mockConfigQueryKey = ["caldav", "getConfig"];
const mockSyncStatusQueryKey = ["caldav", "getSyncStatus"];
const mockSummaryQueryKey = ["caldav", "getSummary"];
const mockConnectionQueryKey = ["caldav", "checkConnection"];

// Mock mutation functions
const mockSaveConfigMutate = vi.fn();
const mockTestConnectionMutate = vi.fn();
const mockDeleteConfigMutate = vi.fn();
const mockTriggerSyncMutate = vi.fn();
const mockGetConfigQueryFn = vi.fn();
const mockGetSyncStatusQueryFn = vi.fn();
const mockGetSummaryQueryFn = vi.fn();

vi.mock("../../trpc", () => ({
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
        pathKey: () => mockSyncStatusQueryKey,
        queryKey: (input: unknown) => [...mockSyncStatusQueryKey, input],
        queryOptions: (input: unknown) => ({
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
      getPassword: {
        queryKey: () => ["caldav", "getPassword"],
      },
      checkConnection: {
        queryKey: () => mockConnectionQueryKey,
      },
      saveConfig: {
        mutationOptions: (options?: object) => ({
          ...options,
          mutationFn: mockSaveConfigMutate,
        }),
      },
      testConnection: {
        mutationOptions: (options?: object) => ({
          ...options,
          mutationFn: mockTestConnectionMutate,
        }),
      },
      deleteConfig: {
        mutationOptions: (options?: object) => ({
          ...options,
          mutationFn: mockDeleteConfigMutate,
        }),
      },
      triggerSync: {
        mutationOptions: (options?: object) => ({
          ...options,
          mutationFn: mockTriggerSyncMutate,
        }),
      },
    },
  }),
}));

describe("CalDAV Mutation Hooks", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
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
      queryClient.setQueryData(mockConfigQueryKey, createMockCaldavConfig({ version: 4 }));

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveConfig(configInput);
      });

      expect(mockSaveConfigMutate.mock.calls[0]?.[0]).toEqual({ ...configInput, version: 4 });
    });

    it("sends a version passed to saveConfig over the cached config's version", async () => {
      const configInput = {
        serverUrl: "https://caldav.example.com",
        username: "testuser",
        password: "testpass",
        enabled: true,
        breakfastTime: "08:00-09:00",
        lunchTime: "12:00-13:00",
        dinnerTime: "18:00-19:00",
        snackTime: "15:00-15:30",
        version: 6,
      };

      mockSaveConfigMutate.mockResolvedValueOnce(createMockCaldavConfig({ version: 7 }));
      queryClient.setQueryData(mockConfigQueryKey, createMockCaldavConfig({ version: 4 }));

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveConfig(configInput);
      });

      expect(mockSaveConfigMutate.mock.calls[0]?.[0]).toEqual(configInput);
    });

    it("resolves whether the config was saved", async () => {
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

      let saved: boolean | undefined;

      await act(async () => {
        saved = await result.current.saveConfig(configInput);
      });

      expect(saved).toBe(true);
    });
  });

  describe("useCaldavMutations cache writes", () => {
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
    const pageKeys = [
      [...mockSyncStatusQueryKey, { page: 1 }],
      [...mockSyncStatusQueryKey, { page: 2 }],
    ];

    // Two sync-status pages and the summary, none of them shown, so nothing refetches.
    function seedStatusAndSummary() {
      for (const key of pageKeys) queryClient.setQueryData(key, { statuses: [], total: 0 });
      queryClient.setQueryData(mockSummaryQueryKey, { pending: 0, synced: 0, failed: 0 });
    }

    function expectStatusAndSummaryInvalidated() {
      for (const key of [...pageKeys, mockSummaryQueryKey]) {
        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
      }
    }

    it("saves the server's answer into the cached config and rereads status, summary and connection", async () => {
      const saved = createMockCaldavConfig({ username: "saved", version: 2 });

      mockSaveConfigMutate.mockResolvedValueOnce(saved);
      seedStatusAndSummary();
      queryClient.setQueryData(mockConnectionQueryKey, { success: false, message: "" });
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveConfig(configInput);
      });

      expect(queryClient.getQueryData(mockConfigQueryKey)).toEqual(saved);
      expectStatusAndSummaryInvalidated();
      expect(queryClient.getQueryState(mockConnectionQueryKey)?.data).toBeUndefined();
    });

    it("keeps a save's answer over a config read begun before it", async () => {
      const saved = createMockCaldavConfig({ username: "saved", version: 2 });
      let answerRead: (config: unknown) => void = () => {};

      queryClient.setQueryData(mockConfigQueryKey, createMockCaldavConfig({ version: 1 }));
      mockGetConfigQueryFn.mockReturnValueOnce(new Promise((resolve) => (answerRead = resolve)));
      void queryClient.fetchQuery({ queryKey: mockConfigQueryKey, queryFn: mockGetConfigQueryFn });
      mockSaveConfigMutate.mockResolvedValueOnce(saved);
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.saveConfig(configInput);
      });
      await act(async () => answerRead(createMockCaldavConfig({ version: 1 })));

      expect(queryClient.getQueryData(mockConfigQueryKey)).toEqual(saved);
    });

    it("clears the cached config on delete and rereads status and summary", async () => {
      mockDeleteConfigMutate.mockResolvedValueOnce({ success: true });
      queryClient.setQueryData(mockConfigQueryKey, createMockCaldavConfig());
      seedStatusAndSummary();
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.deleteConfig();
      });

      expect(queryClient.getQueryData(mockConfigQueryKey)).toBeNull();
      expectStatusAndSummaryInvalidated();
    });

    it("sends the version cached when a save or delete runs, not when the hook rendered", async () => {
      mockSaveConfigMutate.mockResolvedValueOnce(createMockCaldavConfig({ version: 8 }));
      mockDeleteConfigMutate.mockResolvedValueOnce({ success: true });
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      queryClient.setQueryData(mockConfigQueryKey, createMockCaldavConfig({ version: 7 }));
      await act(async () => {
        await result.current.saveConfig(configInput);
      });
      queryClient.setQueryData(mockConfigQueryKey, createMockCaldavConfig({ version: 9 }));
      await act(async () => {
        await result.current.deleteConfig();
      });

      expect(mockSaveConfigMutate.mock.calls[0]?.[0]).toEqual({ ...configInput, version: 7 });
      expect(mockDeleteConfigMutate.mock.calls[0]?.[0]).toEqual({
        deleteEvents: false,
        version: 9,
      });
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

      let response: Tested | undefined;

      await act(async () => {
        response = await result.current.testConnection({
          serverUrl: "https://caldav.example.com",
          username: "testuser",
          password: "testpass",
        });
      });

      expect(response?.success).toBe(true);
      expect(response?.message).toBe("Connection successful");
    });

    it("handles connection failure", async () => {
      mockTestConnectionMutate.mockResolvedValueOnce({
        success: false,
        message: "Invalid credentials",
      });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      let response: Tested | undefined;

      await act(async () => {
        response = await result.current.testConnection({
          serverUrl: "https://caldav.example.com",
          username: "testuser",
          password: "wrongpass",
        });
      });

      expect(response?.success).toBe(false);
      expect(response?.message).toBe("Invalid credentials");
    });
  });

  describe("useCaldavMutations.deleteConfig", () => {
    it("calls deleteConfig mutation", async () => {
      mockDeleteConfigMutate.mockResolvedValueOnce({ success: true });
      queryClient.setQueryData(mockConfigQueryKey, createMockCaldavConfig({ version: 3 }));

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.deleteConfig();
      });

      expect(mockDeleteConfigMutate.mock.calls[0]?.[0]).toEqual({
        deleteEvents: false,
        version: 3,
      });
    });

    it("calls deleteConfig mutation with deleteEvents flag", async () => {
      mockDeleteConfigMutate.mockResolvedValueOnce({ success: true });
      queryClient.setQueryData(mockConfigQueryKey, createMockCaldavConfig({ version: 5 }));

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      await act(async () => {
        await result.current.deleteConfig(true);
      });

      expect(mockDeleteConfigMutate.mock.calls[0]?.[0]).toEqual({
        deleteEvents: true,
        version: 5,
      });
    });
  });

  describe("useCaldavMutations.triggerSync", () => {
    it("calls triggerSync mutation", async () => {
      mockTriggerSyncMutate.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      act(() => result.current.triggerSync());

      await waitFor(() => expect(mockTriggerSyncMutate).toHaveBeenCalled());
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

    it("tracks isTriggeringSync loading state", async () => {
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isTriggeringSync).toBe(false);
    });
  });

  describe("useCaldavMutations success toasts", () => {
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

    it("toasts a save, a delete and a sync's start, translated", async () => {
      const platform = fakePlatformAdapter();

      mockSaveConfigMutate.mockResolvedValueOnce(createMockCaldavConfig());
      mockDeleteConfigMutate.mockResolvedValueOnce({ success: true });
      mockTriggerSyncMutate.mockResolvedValueOnce({ success: true });
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient, platform),
      });

      await act(async () => {
        await result.current.saveConfig(configInput);
        await result.current.deleteConfig();
        result.current.triggerSync();
      });
      await waitFor(() => expect(platform.toast.show).toHaveBeenCalledTimes(3));

      expect(vi.mocked(platform.toast.show).mock.calls.map(([toast]) => toast)).toEqual([
        {
          severity: "success",
          title: "calendar.caldav.configSaved",
          description: "calendar.caldav.configSavedDescription",
        },
        {
          severity: "success",
          title: "calendar.caldav.configDeleted",
          description: "calendar.caldav.configDeletedDescription",
        },
        {
          severity: "default",
          title: "calendar.caldav.retryStarted",
          description: "calendar.caldav.retryStartedDescription",
        },
      ]);
    });
  });

  describe("useCaldavMutations failures", () => {
    it("shows a failed save and resolves that nothing was saved", async () => {
      const platform = fakePlatformAdapter();

      mockSaveConfigMutate.mockRejectedValueOnce(new Error("refused"));
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient, platform),
      });
      let saved: boolean | undefined;

      await act(async () => {
        saved = await result.current.saveConfig({
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

      expect(saved).toBe(false);
      expect(platform.showError).toHaveBeenCalledWith(expect.any(Error), "caldav:save-config");
      expect(platform.toast.show).not.toHaveBeenCalled();
    });

    it("answers a connection test whose request failed as a failed test", async () => {
      mockTestConnectionMutate.mockRejectedValueOnce(new Error("fetch failed"));
      const { result } = renderHook(() => useCaldavMutations(), {
        wrapper: createTestWrapper(queryClient),
      });
      let answer: unknown;

      await act(async () => {
        answer = await result.current.testConnection({
          serverUrl: "https://caldav.example.com",
          username: "testuser",
          password: "testpass",
        });
      });

      expect(answer).toEqual({ success: false, message: "fetch failed" });
    });
  });
});
