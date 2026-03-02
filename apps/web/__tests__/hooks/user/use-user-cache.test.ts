import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDto } from "@norish/trpc";

import { createMockUserSettingsData, createTestQueryClient, createTestWrapper } from "./test-utils";

const mockUserQueryKey = [["user", "get"], { type: "query" }] as const;
const mockAllergiesQueryKey = [["user", "getAllergies"], { type: "query" }] as const;

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    user: {
      get: {
        queryKey: () => mockUserQueryKey,
      },
      getAllergies: {
        queryKey: () => mockAllergiesQueryKey,
      },
    },
  }),
}));

describe("useUserCacheHelpers", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  it("updates user settings cache via tRPC query key", async () => {
    const initialData = createMockUserSettingsData();

    queryClient.setQueryData(mockUserQueryKey, initialData);

    const { useUserCacheHelpers } = await import("@/hooks/user/use-user-cache");
    const { result } = renderHook(() => useUserCacheHelpers(), {
      wrapper: createTestWrapper(queryClient),
    });

    result.current.setUserSettingsData((prev: UserSettingsDto | undefined) =>
      prev
        ? {
            ...prev,
            user: {
              ...prev.user,
              name: "Updated Name",
            },
          }
        : prev
    );

    const after = queryClient.getQueryData(mockUserQueryKey) as typeof initialData;

    expect(after.user.name).toBe("Updated Name");
  });

  it("invalidates using canonical tRPC user query key", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { useUserCacheHelpers } = await import("@/hooks/user/use-user-cache");
    const { result } = renderHook(() => useUserCacheHelpers(), {
      wrapper: createTestWrapper(queryClient),
    });

    result.current.invalidate();

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mockUserQueryKey });
  });
});
