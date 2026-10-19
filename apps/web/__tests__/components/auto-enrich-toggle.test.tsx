import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userQuery = vi.hoisted(() => ({
  value: {
    user: null as { preferences: Record<string, unknown> } | null,
    isLoading: false,
  },
}));

vi.mock("@/hooks/user/use-user-query", () => ({
  useUserSettingsQuery: () => userQuery.value,
}));

const { useAutoEnrichOnAdd } = await import("@/components/shared/auto-enrich-toggle");

describe("useAutoEnrichOnAdd", () => {
  beforeEach(() => {
    userQuery.value = { user: null, isLoading: false };
  });

  it("stays undefined while the profile query is loading", () => {
    userQuery.value = {
      user: { preferences: { autoEnrichOnAdd: false } },
      isLoading: true,
    };

    const { result } = renderHook(() => useAutoEnrichOnAdd());

    expect(result.current[0]).toBeUndefined();
  });

  it("stays undefined when the profile query has no user", () => {
    const { result } = renderHook(() => useAutoEnrichOnAdd());

    expect(result.current[0]).toBeUndefined();
  });

  it("uses a resolved off choice", () => {
    userQuery.value = {
      user: { preferences: { autoEnrichOnAdd: false } },
      isLoading: false,
    };

    const { result } = renderHook(() => useAutoEnrichOnAdd());

    expect(result.current[0]).toBe(false);
  });

  it("uses a resolved on choice", () => {
    userQuery.value = {
      user: { preferences: { autoEnrichOnAdd: true } },
      isLoading: false,
    };

    const { result } = renderHook(() => useAutoEnrichOnAdd());

    expect(result.current[0]).toBe(true);
  });

  it("defaults a resolved profile without the key to on", () => {
    userQuery.value = { user: { preferences: {} }, isLoading: false };

    const { result } = renderHook(() => useAutoEnrichOnAdd());

    expect(result.current[0]).toBe(true);
  });

  it("lets a flip override the resolved profile", () => {
    userQuery.value = {
      user: { preferences: { autoEnrichOnAdd: false } },
      isLoading: false,
    };

    const { result } = renderHook(() => useAutoEnrichOnAdd());

    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
  });

  it("drops the flip when the add flow reopens", () => {
    userQuery.value = {
      user: { preferences: { autoEnrichOnAdd: false } },
      isLoading: false,
    };

    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useAutoEnrichOnAdd(isOpen),
      { initialProps: { isOpen: true } }
    );

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    expect(result.current[0]).toBe(false);
  });
});
