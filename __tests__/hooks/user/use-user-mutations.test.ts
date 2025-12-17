import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  createTestQueryClient,
  createTestWrapper,
  createMockUser,
  createMockApiKey,
  createMockUserSettingsData,
} from "./test-utils";

// Mock tRPC provider
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    user: {
      get: {
        queryKey: () => ["user", "get"],
        queryOptions: () => ({
          queryKey: ["user", "get"],
          queryFn: async () => createMockUserSettingsData(),
        }),
      },
      getAllergies: {
        queryKey: () => ["user", "getAllergies"],
        queryOptions: () => ({
          queryKey: ["user", "getAllergies"],
          queryFn: async () => ({ allergies: [] }),
        }),
      },
      updateName: { mutationOptions: vi.fn() },
      uploadAvatar: { mutationOptions: vi.fn() },
      deleteAvatar: { mutationOptions: vi.fn() },
      deleteAccount: { mutationOptions: vi.fn() },
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

      queryClient.setQueryData(["user", "get"], initialData);

      const { useUserMutations } = await import("@/hooks/user/use-user-mutations");
      const { result } = renderHook(() => useUserMutations(), {
        wrapper: createTestWrapper(queryClient),
      });

      // User mutation functions
      expect(result.current).toHaveProperty("updateName");
      expect(result.current).toHaveProperty("uploadAvatar");
      expect(result.current).toHaveProperty("deleteAvatar");
      expect(result.current).toHaveProperty("deleteAccount");

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

      queryClient.setQueryData(["user", "get"], initialData);

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

      queryClient.setQueryData(["user", "get"], initialData);

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
  });
});
