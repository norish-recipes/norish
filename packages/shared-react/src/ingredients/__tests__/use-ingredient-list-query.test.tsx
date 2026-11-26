import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useIngredientListQuery } from "../use-ingredient-query";

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
