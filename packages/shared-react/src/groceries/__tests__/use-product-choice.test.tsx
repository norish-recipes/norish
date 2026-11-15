import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreDto, StoreProductDto } from "@norish/shared/contracts";
import { useProductChoice } from "@norish/shared-react/groceries";

const held = vi.hoisted(() => ({
  chooseProduct: vi.fn(),
  linkFor: null as unknown,
  lookup: { data: undefined, isLoading: false } as { data?: unknown; isLoading: boolean },
}));

vi.mock("../use-store-products-mutations", () => ({ useChooseProduct: () => held.chooseProduct }));
vi.mock("../use-store-prices", () => ({ useLinkFor: () => held.linkFor }));
vi.mock("../use-store-products-query", () => ({ useProductLink: () => held.lookup }));

const store = { id: "s1", name: "AH" } as StoreDto;
const product = { id: "p1", name: "Avocado" } as StoreProductDto;
const options = {
  groceryName: "avocado",
  settledName: "avocado",
  ingredientId: "i1",
  stores: [store],
  selectedStoreId: "s1",
  resetOn: "g1",
};

describe("useProductChoice", () => {
  beforeEach(() => {
    held.chooseProduct.mockReset();
    held.linkFor = null;
    held.lookup = { data: undefined, isLoading: false };
  });

  it("writes a held choice once, on commit, against the saved name", () => {
    const { result } = renderHook(() => useProductChoice(options));

    act(() => result.current.setChoice({ kind: "product", storeProductId: "p2" }));
    expect(held.chooseProduct).not.toHaveBeenCalled();
    act(() => result.current.commit());

    expect(held.chooseProduct).toHaveBeenCalledWith(
      "s1",
      "avocado",
      { kind: "product", storeProductId: "p2" },
      "i1"
    );
    expect(result.current.choice).toBeNull();
  });

  it("writes nothing for the product it already points at", () => {
    held.linkFor = { product };
    const { result } = renderHook(() => useProductChoice(options));

    act(() => result.current.setChoice({ kind: "product", storeProductId: "p1" }));
    act(() => result.current.commit());

    expect(held.chooseProduct).not.toHaveBeenCalled();
  });

  it("does not unlink what was never linked", () => {
    const { result } = renderHook(() => useProductChoice(options));

    act(() => result.current.setChoice({ kind: "none" }));
    act(() => result.current.commit());

    expect(held.chooseProduct).not.toHaveBeenCalled();
  });

  it("drops the held choice when the Store changes", () => {
    const { result, rerender } = renderHook((props) => useProductChoice(props), {
      initialProps: options,
    });

    act(() => result.current.setChoice({ kind: "product", storeProductId: "p2" }));
    rerender({ ...options, selectedStoreId: "s2" });

    expect(result.current.choice).toBeNull();
  });

  it("reads a Store the list does not cover on its own", () => {
    held.lookup = { data: { product }, isLoading: false };
    const { result } = renderHook(() => useProductChoice(options));

    expect(result.current.linkedProduct).toBe(product);
  });
});
