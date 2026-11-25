import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionsData } from "@norish/shared-react/reader";
import { createTestQueryClient } from "@norish/shared-react/platform/testing";
import {
  normalizePermissionsData,
  selectCanDeleteRecipe,
  usePermissions,
  useRecipePermissions,
} from "@norish/shared-react/reader";

import { answerRead, keyOf, resetTRPCFake } from "../../trpc/testing";
import { readerWrapper } from "./test-utils";

const PERMISSIONS_KEY = keyOf("permissions.get");

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const HOUSEHOLD_POLICY: PermissionsData = {
  recipePolicy: { view: "everyone", edit: "household", delete: "household" },
  isAIEnabled: true,
  canDrawImages: false,
  householdId: "readers-household",
  isServerAdmin: false,
};

describe("permission selectors", () => {
  it("normalizes undefined permission data to conservative defaults", () => {
    expect(normalizePermissionsData(undefined)).toEqual({
      recipePolicy: { view: "household", edit: "household", delete: "household" },
      isAIEnabled: false,
      canDrawImages: false,
      householdId: null,
      isServerAdmin: false,
    });
  });

  it("decides by the row's household, as the server does", () => {
    const permissions = normalizePermissionsData(HOUSEHOLD_POLICY);

    expect(selectCanDeleteRecipe(permissions, "readers-household")).toBe(true);
    expect(selectCanDeleteRecipe(permissions, "another-household")).toBe(false);
    expect(
      selectCanDeleteRecipe(
        { ...permissions, recipePolicy: { ...permissions.recipePolicy, delete: "everyone" } },
        "another-household"
      )
    ).toBe(true);
  });

  it("allows nothing before the server has named the reader's household", () => {
    const permissions = normalizePermissionsData({ ...HOUSEHOLD_POLICY, householdId: null });

    expect(selectCanDeleteRecipe(permissions, "readers-household")).toBe(false);
  });

  it("gives a server admin nothing past the policy", () => {
    const permissions = normalizePermissionsData({ ...HOUSEHOLD_POLICY, isServerAdmin: true });

    expect(selectCanDeleteRecipe(permissions, "another-household")).toBe(false);
  });
});

beforeEach(() => resetTRPCFake());

describe("usePermissions", () => {
  it("answers with the defaults until the server has, then with the server's", async () => {
    const { result } = renderHook(() => usePermissions((p) => p.isAIEnabled), {
      wrapper: readerWrapper(createTestQueryClient()),
    });

    expect(result.current).toBe(false);
    act(() => answerRead("permissions.get", HOUSEHOLD_POLICY));
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
  it("decides by the policy and the row's household", async () => {
    const { result } = renderHook(() => useRecipePermissions(), {
      wrapper: readerWrapper(createTestQueryClient()),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.canViewRecipe("readers-household")).toBe(false);

    act(() => answerRead("permissions.get", HOUSEHOLD_POLICY));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canViewRecipe("another-household")).toBe(true);
    expect(result.current.canEditRecipe("another-household")).toBe(false);
    expect(result.current.canDeleteRecipe("readers-household")).toBe(true);
  });
});
