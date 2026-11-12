import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChooseProduct, useStoreGroceryCount } from "@norish/shared-react/groceries";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, answerRead, failCall, keyOf, resetTRPCFake } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const PRICES = keyOf("stores.groceryPrices");

beforeEach(() => resetTRPCFake());

function choose() {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();
  const { result } = renderHook(() => useChooseProduct(), {
    wrapper: createTestWrapper(queryClient, platform),
  });

  queryClient.setQueryData(PRICES, []);
  act(() => result.current("store-1", "kaas", { kind: "none" }));

  return { queryClient, platform };
}

describe("useChooseProduct", () => {
  it("rereads the prices once the server took the choice", async () => {
    const { queryClient, platform } = choose();

    await answerCall("stores.chooseProduct", { ok: true });

    await waitFor(() => expect(queryClient.getQueryState(PRICES)?.isInvalidated).toBe(true));
    expect(platform.showError).not.toHaveBeenCalled();
  });

  it("tells the reader a refused choice and rereads the prices", async () => {
    const { queryClient, platform } = choose();

    await failCall("stores.chooseProduct");

    await waitFor(() => expect(queryClient.getQueryState(PRICES)?.isInvalidated).toBe(true));
    expect(platform.showError).toHaveBeenCalledWith(expect.any(Error), "stores:chooseProduct");
  });
});

describe("useStoreGroceryCount", () => {
  it("reads nothing without a Store, and a Store's count once it answers", async () => {
    const queryClient = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ storeId }: { storeId: string | null }) => useStoreGroceryCount(storeId),
      { wrapper: createTestWrapper(queryClient), initialProps: { storeId: null } }
    );

    expect(result.current).toBeUndefined();
    expect(queryClient.isFetching()).toBe(0);

    rerender({ storeId: "store-1" });

    await waitFor(() => {
      answerRead("stores.getGroceryCount", 3);
      expect(result.current).toBe(3);
    });
  });
});
