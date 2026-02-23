import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockUser,
  createMockApiKey,
  createMockUserSettingsData,
} from "./test-utils";

const mockUserQueryKey = [["user", "get"], { type: "query" }] as const;
const mockAllergiesQueryKey = [["user", "getAllergies"], { type: "query" }] as const;

// Mock tRPC provider
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    user: {
      get: {
        queryKey: () => mockUserQueryKey,
        queryOptions: () => ({
          queryKey: mockUserQueryKey,
          queryFn: async () => createMockUserSettingsData(),
        }),
      },
      getAllergies: {
        queryKey: () => mockAllergiesQueryKey,
        queryOptions: () => ({
          queryKey: mockAllergiesQueryKey,
          queryFn: async () => ({ allergies: [] }),
        }),
      },
      updateName: { mutationOptions: vi.fn() },
      uploadAvatar: { mutationOptions: vi.fn() },
      deleteAvatar: { mutationOptions: vi.fn() },
      deleteAccount: { mutationOptions: vi.fn() },
      updatePreferences: { mutationOptions: vi.fn() },
      apiKeys: {
        create: { mutationOptions: vi.fn() },
        delete: { mutationOptions: vi.fn() },
        toggle: { mutationOptions: vi.fn() },
      },
      setAllergies: { mutationOptions: vi.fn() },
    },
  }),
}));

describe("useUserMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("module structure", () => {
    it("exports all expected mutation functions", async () => {
      const initialData = createMockUserSettingsData(
        createMockUser({ id: "user-1", name: "Test User" }),
        [createMockApiKey({ id: "key-1", name: "Test Key" })]
      );

      queryClient.setQueryData(mockUserQueryKey, initialData);

      const { useUserMutations } = await import("@/hooks/user/use-user-mutations");
      const { result } = renderHook(() => useUserMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // User mutation functions
      expect(result.current).toHaveProperty("updateName");
      expect(result.current).toHaveProperty("uploadAvatar");
      expect(result.current).toHaveProperty("deleteAvatar");
      expect(result.current).toHaveProperty("deleteAccount");
      expect(result.current).toHaveProperty("updatePreferences");

      // API key mutation functions
      expect(result.current).toHaveProperty("createApiKey");
      expect(result.current).toHaveProperty("deleteApiKey");
      expect(result.current).toHaveProperty("toggleApiKey");

      // All should be functions (not useMutation results)
      expect(typeof result.current.updateName).toBe("function");
      expect(typeof result.current.uploadAvatar).toBe("function");
      expect(typeof result.current.deleteAvatar).toBe("function");
      expect(typeof result.current.deleteAccount).toBe("function");
      expect(typeof result.current.createApiKey).toBe("function");
      expect(typeof result.current.deleteApiKey).toBe("function");
      expect(typeof result.current.toggleApiKey).toBe("function");
    });

    it("exports loading state properties", async () => {
      const initialData = createMockUserSettingsData(
        createMockUser({ id: "user-1", name: "Test User" }),
        [createMockApiKey({ id: "key-1", name: "Test Key" })]
      );

      queryClient.setQueryData(mockUserQueryKey, initialData);

      const { useUserMutations } = await import("@/hooks/user/use-user-mutations");
      const { result } = renderHook(() => useUserMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Loading state flags
      expect(result.current).toHaveProperty("isUpdatingName");
      expect(result.current).toHaveProperty("isUploadingAvatar");
      expect(result.current).toHaveProperty("isDeletingAvatar");
      expect(result.current).toHaveProperty("isDeletingAccount");
      expect(result.current).toHaveProperty("isCreatingApiKey");
      expect(result.current).toHaveProperty("isDeletingApiKey");
      expect(result.current).toHaveProperty("isTogglingApiKey");
      expect(result.current).toHaveProperty("isUpdatingAllergies");
      expect(result.current).toHaveProperty("isUpdatingPreferences");

      // All should be booleans initially false
      expect(typeof result.current.isUpdatingName).toBe("boolean");
      expect(result.current.isUpdatingName).toBe(false);
      expect(typeof result.current.isUploadingAvatar).toBe("boolean");
      expect(result.current.isUploadingAvatar).toBe(false);
    });
  });

  describe("API contract", () => {
    it("mutation functions return promises (async functions)", async () => {
      const initialData = createMockUserSettingsData(
        createMockUser({ id: "user-1", name: "Test User" }),
        []
      );

      queryClient.setQueryData(mockUserQueryKey, initialData);

      const { useUserMutations } = await import("@/hooks/user/use-user-mutations");
      const { result } = renderHook(() => useUserMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Verify the functions are async (their .constructor.name or toString)
      expect(result.current.updateName.constructor.name).toBe("AsyncFunction");
      expect(result.current.uploadAvatar.constructor.name).toBe("AsyncFunction");
      expect(result.current.deleteAvatar.constructor.name).toBe("AsyncFunction");
      expect(result.current.deleteAccount.constructor.name).toBe("AsyncFunction");
      expect(result.current.createApiKey.constructor.name).toBe("AsyncFunction");
      expect(result.current.deleteApiKey.constructor.name).toBe("AsyncFunction");
      expect(result.current.toggleApiKey.constructor.name).toBe("AsyncFunction");
      expect(result.current.setAllergies.constructor.name).toBe("AsyncFunction");
    });

    it("rolls back optimistic preferences update on failure", async () => {
      // Reset modules so we can remock the trpc provider for this test
      vi.resetModules();

      // Track mutation calls so we can verify optimistic state before resolution
      let capturedMutationFn: (() => void) | null = null;
      const mutationPromise = new Promise<{ success: boolean }>((resolve) => {
        capturedMutationFn = () => resolve({ success: false });
      });

      // Provide a tRPC mock that returns a failing updatePreferences mutation
      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          user: {
            get: {
              queryKey: () => mockUserQueryKey,
              queryOptions: () => ({
                queryKey: mockUserQueryKey,
                queryFn: async () => ({ user: {} as any, apiKeys: [] }),
              }),
            },
            getAllergies: {
              queryKey: () => mockAllergiesQueryKey,
              queryOptions: () => ({
                queryKey: mockAllergiesQueryKey,
                queryFn: async () => ({ allergies: [] }),
              }),
            },
            updatePreferences: {
              mutationOptions: () => ({ mutationFn: () => mutationPromise }),
            },
            // minimal stubs for other used keys
            apiKeys: {
              create: { mutationOptions: vi.fn() },
              delete: { mutationOptions: vi.fn() },
              toggle: { mutationOptions: vi.fn() },
            },
            updateName: { mutationOptions: vi.fn() },
            uploadAvatar: { mutationOptions: vi.fn() },
            deleteAvatar: { mutationOptions: vi.fn() },
            deleteAccount: { mutationOptions: vi.fn() },
            setAllergies: { mutationOptions: vi.fn() },
          },
        }),
      }));

      // Re-import the hook under test after remocking
      const { useUserMutations } = await import("@/hooks/user/use-user-mutations");

      const initialData = createMockUserSettingsData(
        createMockUser({ id: "user-1", name: "Test User", preferences: { timersEnabled: true } }),
        []
      );

      queryClient.setQueryData(mockUserQueryKey, initialData);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUserMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Start the mutation (don't await yet)
      const resPromise = result.current.updatePreferences({ timersEnabled: false });

      // Verify optimistic update was applied before mutation resolves
      await vi.waitFor(() => {
        const optimistic = queryClient.getQueryData(mockUserQueryKey) as any;

        expect(optimistic.user.preferences.timersEnabled).toBe(false);
      });

      // Now resolve the mutation with failure
      capturedMutationFn!();

      const res = await resPromise;

      expect(res.success).toBe(false);

      // Ensure the cache was rolled back to the previous value
      const after = queryClient.getQueryData(mockUserQueryKey);

      expect(after).toEqual(initialData);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mockUserQueryKey });
    });

    it("merges server response into cache on successful preference update", async () => {
      vi.resetModules();

      const serverPreferences = { timersEnabled: false, showConversionButton: true };

      vi.doMock("@/app/providers/trpc-provider", () => ({
        useTRPC: () => ({
          user: {
            get: {
              queryKey: () => mockUserQueryKey,
              queryOptions: () => ({
                queryKey: mockUserQueryKey,
                queryFn: async () => ({ user: {} as any, apiKeys: [] }),
              }),
            },
            getAllergies: {
              queryKey: () => mockAllergiesQueryKey,
              queryOptions: () => ({
                queryKey: mockAllergiesQueryKey,
                queryFn: async () => ({ allergies: [] }),
              }),
            },
            updatePreferences: {
              mutationOptions: () => ({
                mutationFn: async () => ({
                  success: true,
                  preferences: serverPreferences,
                }),
              }),
            },
            apiKeys: {
              create: { mutationOptions: vi.fn() },
              delete: { mutationOptions: vi.fn() },
              toggle: { mutationOptions: vi.fn() },
            },
            updateName: { mutationOptions: vi.fn() },
            uploadAvatar: { mutationOptions: vi.fn() },
            deleteAvatar: { mutationOptions: vi.fn() },
            deleteAccount: { mutationOptions: vi.fn() },
            setAllergies: { mutationOptions: vi.fn() },
          },
        }),
      }));

      const { useUserMutations } = await import("@/hooks/user/use-user-mutations");

      const initialData = createMockUserSettingsData(
        createMockUser({ id: "user-1", name: "Test User", preferences: { timersEnabled: true } }),
        []
      );

      queryClient.setQueryData(mockUserQueryKey, initialData);

      const { result } = renderHook(() => useUserMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      const res = await result.current.updatePreferences({ timersEnabled: false });

      expect(res.success).toBe(true);
      expect(res.preferences).toEqual(serverPreferences);

      // Cache should reflect server-returned preferences
      const after = queryClient.getQueryData(mockUserQueryKey) as any;

      expect(after.user.preferences).toEqual(serverPreferences);
    });
  });
});
