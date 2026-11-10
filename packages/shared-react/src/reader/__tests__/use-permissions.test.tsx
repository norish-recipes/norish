import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PermissionsData } from "@norish/shared-react/reader";
import { createTestQueryClient } from "@norish/shared-react/platform/testing";
import {
  normalizePermissionsData,
  selectCanDeleteRecipe,
  usePermissions,
  useRecipePermissions,
} from "@norish/shared-react/reader";

import { READER, readerWrapper } from "./test-utils";

const PERMISSIONS_KEY = ["permissions", "get"];

const served = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    permissions: {
      get: {
        queryOptions: () => ({
          queryKey: ["permissions", "get"],
          queryFn: async () => served.current,
        }),
      },
    },
    user: {
      get: {
        queryOptions: () => ({ queryKey: ["user", "get"], queryFn: () => new Promise(() => {}) }),
      },
    },
  }),
}));

const HOUSEHOLD_POLICY: PermissionsData = {
  recipePolicy: { view: "household", edit: "household", delete: "owner" },
  isAIEnabled: true,
  canDrawImages: false,
  householdUserIds: [READER.id, "partner"],
  isServerAdmin: false,
};

describe("permission selectors", () => {
  it("normalizes undefined permission data to conservative defaults", () => {
    expect(normalizePermissionsData(undefined)).toEqual({
      recipePolicy: { view: "owner", edit: "owner", delete: "owner" },
      isAIEnabled: false,
      canDrawImages: false,
      householdUserIds: null,
      isServerAdmin: false,
    });
  });

  it("allows delete when household policy and owner is in household", () => {
    const permissions = normalizePermissionsData({
      ...HOUSEHOLD_POLICY,
      recipePolicy: { view: "household", edit: "household", delete: "household" },
      householdUserIds: ["owner-1", "owner-2"],
    });

    expect(selectCanDeleteRecipe(permissions, "viewer-1", "owner-1")).toBe(true);
    expect(selectCanDeleteRecipe(permissions, "viewer-1", "owner-3")).toBe(false);
  });
});

describe("usePermissions", () => {
  it("answers with the defaults until the server has, then with the server's", async () => {
    served.current = HOUSEHOLD_POLICY;
    const { result } = renderHook(() => usePermissions((p) => p.isAIEnabled), {
      wrapper: readerWrapper(createTestQueryClient()),
    });

    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("doesn't render a reader of one permission when another changes", async () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(PERMISSIONS_KEY, HOUSEHOLD_POLICY);
    let renders = 0;

    const { result } = renderHook(
      () => {
        renders += 1;

        return usePermissions((p) => p.isServerAdmin);
      },
      { wrapper: readerWrapper(queryClient) }
    );
    const before = renders;

    act(() => {
      queryClient.setQueryData(PERMISSIONS_KEY, { ...HOUSEHOLD_POLICY, isAIEnabled: false });
    });
    // TanStack tells its readers a task later.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result.current).toBe(false);
    expect(renders).toBe(before);
  });
});

describe("useRecipePermissions", () => {
  it("decides by the policy, the household and who the Reader is", async () => {
    served.current = HOUSEHOLD_POLICY;
    const { result } = renderHook(() => useRecipePermissions(), {
      wrapper: readerWrapper(createTestQueryClient()),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.canViewRecipe("partner")).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canViewRecipe("partner")).toBe(true);
    expect(result.current.canEditRecipe("stranger")).toBe(false);
    expect(result.current.canDeleteRecipe("partner")).toBe(false);
    expect(result.current.canDeleteRecipe(READER.id)).toBe(true);
  });
});
