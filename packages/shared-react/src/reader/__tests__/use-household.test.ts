import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HouseholdData } from "@norish/shared-react/reader";
import { createTestQueryClient } from "@norish/shared-react/platform/testing";
import { useHousehold, useHouseholdCacheHelpers } from "@norish/shared-react/reader";

import { answerRead, failRead, keyOf, resetTRPCFake } from "../../trpc/testing";
import { createMockHouseholdData, createMockHouseholdSettings, readerWrapper } from "./test-utils";

const mockQueryKey = keyOf("households.get");

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

describe("useHousehold", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    resetTRPCFake();
    queryClient = createTestQueryClient();
  });

  describe("initial state", () => {
    it("returns null household when no data is loaded", () => {
      const { result } = renderHook(() => useHousehold(), {
        wrapper: readerWrapper(queryClient),
      });

      expect(result.current.household).toBeNull();
    });

    it("returns loading state initially", () => {
      const { result } = renderHook(() => useHousehold(), {
        wrapper: readerWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  it("says whether the Reader administers the household", async () => {
    const users = [
      { id: "admin", name: "A", isAdmin: true, version: 1 },
      { id: "member", name: "M", isAdmin: false, version: 1 },
    ];

    for (const [reader, isAdmin] of [
      ["admin", true],
      ["member", false],
    ] as const) {
      const client = createTestQueryClient();

      client.setQueryData(
        mockQueryKey,
        createMockHouseholdData(createMockHouseholdSettings({ users }), reader)
      );

      const { result } = renderHook(() => useHousehold(), { wrapper: readerWrapper(client) });

      expect(result.current.isAdmin).toBe(isAdmin);
    }
  });

  describe("data fetching", () => {
    it("returns household data after successful fetch", async () => {
      const mockHousehold = createMockHouseholdSettings({
        id: "h1",
        name: "Test Household",
      });

      const { result } = renderHook(() => useHousehold(), {
        wrapper: readerWrapper(queryClient),
      });

      act(() => answerRead("households.get", createMockHouseholdData(mockHousehold, "user-1")));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.household).toEqual(mockHousehold);
      expect(result.current.currentUserId).toBe("user-1");
    });

    it("handles fetch failure gracefully", async () => {
      const { result } = renderHook(() => useHousehold(), {
        wrapper: readerWrapper(queryClient),
      });

      act(() => failRead("households.get", new Error("Network error")));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.household).toBeNull();
    });
  });

  describe("useHouseholdCacheHelpers().setHouseholdData", () => {
    it("updates query cache with new data", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1", name: "Initial" });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      queryClient.setQueryData(mockQueryKey, initialData);

      const { result } = renderHook(() => ({ ...useHousehold(), ...useHouseholdCacheHelpers() }), {
        wrapper: readerWrapper(queryClient),
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

      queryClient.setQueryData(mockQueryKey, initialData);

      const { result } = renderHook(() => ({ ...useHousehold(), ...useHouseholdCacheHelpers() }), {
        wrapper: readerWrapper(queryClient),
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

  describe("useHouseholdCacheHelpers().invalidate", () => {
    it("invalidates queries correctly", async () => {
      const initialHousehold = createMockHouseholdSettings({ id: "h1", name: "Test" });
      const initialData = createMockHouseholdData(initialHousehold, "user-1");

      queryClient.setQueryData(mockQueryKey, initialData);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useHouseholdCacheHelpers(), {
        wrapper: readerWrapper(queryClient),
      });

      act(() => {
        result.current.invalidate();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: mockQueryKey });
    });
  });
});
