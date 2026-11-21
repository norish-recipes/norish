import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ResolvedProductLink,
  StoreProductChoice,
  StoreProductDto,
} from "@norish/shared/contracts";
import { useChooseProduct } from "@norish/shared-react/groceries";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, failCall, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const PRICES = keyOf("stores.groceryPrices");

beforeEach(() => resetTRPCFake());

const known: StoreProductDto = {
  id: "11111111-1111-4111-8111-111111111111",
  storeId: "store-1",
  name: "Jong belegen",
  pageUrl: null,
  price: 4.5,
  currency: "EUR",
  size: "500 g",
  packQuantity: 500,
  packUnit: "gram",
  packByWeight: false,
  packByHand: false,
  regularPrice: null,
  dealWords: null,
  pricedAt: new Date(),
  isManual: false,
  version: 1,
};

const before: ResolvedProductLink = {
  storeId: "store-1",
  ingredientId: "cheese",
  triedAt: new Date(),
  product: null,
  suggestion: null,
};

function choose(choice: StoreProductChoice = { kind: "none" }) {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();
  const { result } = renderHook(() => useChooseProduct(), {
    wrapper: createTestWrapper(queryClient, platform),
  });

  queryClient.setQueryData(PRICES, [before]);
  queryClient.setQueryData(keyOf("stores.listProducts", { storeId: "store-1" }), [known]);
  act(() => result.current("store-1", "kaas", choice, "cheese"));

  return { queryClient, platform };
}

const held = (queryClient: ReturnType<typeof createTestQueryClient>) =>
  queryClient.getQueryData<ResolvedProductLink[]>(PRICES);

describe("useChooseProduct", () => {
  it("rereads the prices once the server took the choice", async () => {
    const { queryClient, platform } = choose();

    await answerCall("stores.chooseProduct", { ok: true });

    await waitFor(() => expect(queryClient.getQueryState(PRICES)?.isInvalidated).toBe(true));
    expect(platform.showError).not.toHaveBeenCalled();
  });

  it("prices the line at once with a typed price, before the server answers", () => {
    const { queryClient } = choose({
      kind: "manual",
      id: "22222222-2222-4222-8222-222222222222",
      name: "kaas",
      price: 0.89,
      currency: "EUR",
      pack: { quantity: 1, unit: "piece", byWeight: false },
    });

    expect(held(queryClient)).toEqual([
      expect.objectContaining({
        storeId: "store-1",
        ingredientId: "cheese",
        product: expect.objectContaining({
          id: "22222222-2222-4222-8222-222222222222",
          price: 0.89,
          currency: "EUR",
          packQuantity: 1,
          packUnit: "piece",
          isManual: true,
        }),
      }),
    ]);
  });

  it("prices the line at once with a product the Store already knows", () => {
    const { queryClient } = choose({ kind: "product", storeProductId: known.id });

    expect(held(queryClient)?.[0]?.product).toEqual(known);
  });

  it("takes the product off at once when the shopper says it is none of them", () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useChooseProduct(), {
      wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
    });

    queryClient.setQueryData(PRICES, [{ ...before, product: known }]);
    act(() => result.current("store-1", "kaas", { kind: "none" }, "cheese"));

    expect(held(queryClient)?.[0]?.product).toBeNull();
  });

  it("puts the price back, tells the reader and rereads when the choice is refused", async () => {
    const { queryClient, platform } = choose({ kind: "product", storeProductId: known.id });

    await failCall("stores.chooseProduct");

    await waitFor(() => expect(queryClient.getQueryState(PRICES)?.isInvalidated).toBe(true));
    expect(held(queryClient)).toEqual([before]);
    expect(platform.showError).toHaveBeenCalledWith(expect.any(Error), "stores:chooseProduct");
  });

  it("keeps the price when the choice is Queued for Replay", async () => {
    const { queryClient, platform } = choose({ kind: "product", storeProductId: known.id });

    const call = await sentCall("stores.chooseProduct");

    // Unreachable and admitted to the Outbox: the Queued signal.
    await act(async () => call.deferred.reject(new TypeError("Failed to fetch")));

    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(held(queryClient)?.[0]?.product).toEqual(known);
    expect(queryClient.getQueryState(PRICES)?.isInvalidated).toBe(false);
    expect(platform.showError).not.toHaveBeenCalled();
  });
});
