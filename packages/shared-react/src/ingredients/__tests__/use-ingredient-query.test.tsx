import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useFoodRecipes, useIngredientListQuery } from "../use-ingredient-query";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

afterEach(resetTRPCFake);

describe("useIngredientListQuery", () => {
  it("says a first read failed, and reads again on retry", async () => {
    let reads = 0;

    serveTRPC(async () => {
      reads += 1;
      if (reads === 1) throw new Error("down");

      return { items: [], nextCursor: null };
    });

    const { result } = renderHook(() => useIngredientListQuery({ locale: "en" }), {
      wrapper: createTestWrapper(createTestQueryClient(), fakePlatformAdapter()),
    });

    await waitFor(() => expect(result.current.failed).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.failed).toBe(false));
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useFoodRecipes", () => {
  const wrapper = () => createTestWrapper(createTestQueryClient(), fakePlatformAdapter());

  it("lists the recipes that use a food, all at once, once its uses are read", async () => {
    serveTRPC(async () => ({
      recipes: [{ id: "r1", name: "Soup" }],
      groceries: [],
      pantry: false,
      counts: { recipeLines: 1, groceries: 0, pantry: 0 },
    }));

    const { result } = renderHook(() => useFoodRecipes("soy"), { wrapper: wrapper() });

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.recipes).toEqual([{ id: "r1", name: "Soup" }]);
    expect(result.current.hasMore).toBe(false);
  });

  it("says a failed read, and reads again on retry", async () => {
    let reads = 0;

    serveTRPC(async () => {
      reads += 1;
      if (reads === 1) throw new Error("down");

      return { recipes: [], groceries: [], pantry: false, counts: {} };
    });

    const { result } = renderHook(() => useFoodRecipes("soy"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.failed).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });
});
