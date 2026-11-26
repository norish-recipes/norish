import { act, renderHook, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import {
  useFoodRecipes,
  useIngredientListQuery,
  useIngredientQuery,
} from "../use-ingredient-query";

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

describe("useIngredientQuery", () => {
  const wrapper = () => createTestWrapper(createTestQueryClient(), fakePlatformAdapter());

  it("hands over the food once read", async () => {
    serveTRPC(async () => ({ id: "soy", name: "Soy sauce" }));

    const { result } = renderHook(() => useIngredientQuery("soy", "en"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.item?.id).toBe("soy"));
    expect(result.current.failed).toBe(false);
    expect(result.current.gone).toBe(false);
  });

  it("says a failed read failed, and reads again on retry", async () => {
    let reads = 0;

    serveTRPC(async () => {
      reads += 1;
      if (reads === 1) throw new Error("down");

      return { id: "soy", name: "Soy sauce" };
    });

    const { result } = renderHook(() => useIngredientQuery("soy", "en"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.gone).toBe(false);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.item?.id).toBe("soy"));
    expect(result.current.failed).toBe(false);
  });

  it("says a food the server no longer has is gone, not failed", async () => {
    serveTRPC(async () => {
      throw TRPCClientError.from({
        error: { message: "not-found", code: -32004, data: { code: "NOT_FOUND", httpStatus: 404 } },
      });
    });

    const { result } = renderHook(() => useIngredientQuery("soy", "en"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.gone).toBe(true));
    expect(result.current.failed).toBe(false);
    expect(result.current.item).toBeNull();
  });
});
