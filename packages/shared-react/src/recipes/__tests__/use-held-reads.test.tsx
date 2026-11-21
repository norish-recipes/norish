import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";
import { useHeldRecipeName } from "@norish/shared-react/recipes";

import { useTRPC } from "../../trpc";
import { resetTRPCFake } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

beforeEach(() => resetTRPCFake());

// The fake proxy is a plain object, so its keys are read outside a render.
const RECIPE_KEY = useTRPC().recipes.get.queryKey({ id: "r-1" });

describe("useHeldRecipeName", () => {
  it("is the held recipe's name, and never asks the server", () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(RECIPE_KEY, { id: "r-1", name: "Pasta" });
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useHeldRecipeName(id),
      { wrapper: createTestWrapper(queryClient), initialProps: { id: "r-1" } }
    );

    expect(result.current).toBe("Pasta");
    rerender({ id: "r-2" });
    expect(result.current).toBeUndefined();
    expect(queryClient.isFetching()).toBe(0);
  });

  it("reads nothing without an id", () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useHeldRecipeName(null), {
      wrapper: createTestWrapper(queryClient),
    });

    expect(result.current).toBeUndefined();
    expect(queryClient.isFetching()).toBe(0);
  });
});
