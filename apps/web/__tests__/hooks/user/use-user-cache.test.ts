import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDto } from "@norish/trpc";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { createMockUserSettingsData } from "./test-utils";

const mockUserQueryKey = [["user", "get"], { type: "query" }] as const;
const mockAllergiesQueryKey = [["user", "getAllergies"], { type: "query" }] as const;

vi.mock("@norish/shared-react/trpc", () => ({
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

  it("keeps a write over a read that began before it", async () => {
    const initialData = createMockUserSettingsData();
    let answer: (data: UserSettingsDto) => void = () => {};

    queryClient.setQueryData(mockUserQueryKey, initialData);
    const read = queryClient.fetchQuery({
      queryKey: mockUserQueryKey,
      queryFn: () => new Promise<UserSettingsDto>((resolve) => (answer = resolve)),
    });

    const { useUserCacheHelpers } = await import("@/hooks/user/use-user-cache");
    const { result } = renderHook(() => useUserCacheHelpers(), {
      wrapper: createTestWrapper(queryClient),
    });

    result.current.mergeUser({ name: "Updated Name" });
    answer(initialData);
    await read;

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
