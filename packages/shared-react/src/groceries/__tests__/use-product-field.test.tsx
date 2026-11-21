import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreDto, StoreProductDto } from "@norish/shared/contracts";
import { useProductField } from "@norish/shared-react/groceries";

const shop = vi.hoisted(() => ({
  candidates: [] as unknown[],
  stored: [] as unknown[],
}));

vi.mock("../use-store-products-query", () => ({
  useShopSearch: () => ({
    data: { answered: true, candidates: shop.candidates },
    isPending: false,
    isFetching: false,
  }),
  useStoreProducts: () => ({ data: shop.stored }),
}));

const store = {
  id: "s1",
  name: "AH",
  website: "https://www.ah.nl",
  searchAddress: "https://www.ah.nl/zoeken?query={query}",
} as StoreDto;
const words = {
  per: (unit: string) => `per ${unit}`,
  pieces: (count: number) => `${count} pieces`,
};
const linked = {
  id: "p1",
  name: "AH Avocado",
  price: 0.99,
  currency: "EUR",
  size: null,
  pageUrl: "https://www.ah.nl/p1",
  regularPrice: null,
  dealWords: null,
  isManual: false,
} as unknown as StoreProductDto;

function render(onChoice = vi.fn(), linkedProduct: StoreProductDto | null = null) {
  return renderHook(() =>
    useProductField({
      store,
      groceryName: "avocado",
      linkedProduct,
      choice: null,
      onChoice,
      locale: "en",
      packWords: words,
    })
  );
}

describe("useProductField", () => {
  beforeEach(() => {
    shop.candidates = [];
    shop.stored = [];
  });

  it("opens reading what the grocery is linked to", () => {
    const { result } = render(vi.fn(), linked);

    expect(result.current.term).toBe("AH Avocado");
    expect(result.current.manualPrice).toBe("0.99");
    expect(result.current.manualCurrency).toBe("EUR");
  });

  it("hands over a price typed by hand as a manual product", () => {
    const onChoice = vi.fn();
    const { result } = render(onChoice);

    act(() => result.current.editPrice("1,29"));

    expect(onChoice).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "manual", price: 1.29, name: "avocado" })
    );
  });

  it("says a price that is not one, and keeps the choice from it", () => {
    const { result } = render();

    act(() => result.current.editPrice("abc"));

    expect(result.current.priceInvalid).toBe(true);
    expect(result.current.hasTypedPrice).toBe(false);
  });

  it("writes a Miss when the linked product is let go", () => {
    const onChoice = vi.fn();
    const { result } = render(onChoice, linked);

    act(() => result.current.unlink());

    expect(onChoice).toHaveBeenLastCalledWith({ kind: "none" });
    expect(result.current.unlinked).toBe(true);
    expect(result.current.term).toBe("");
  });

  it("takes a tapped row and shows its price", () => {
    shop.candidates = [
      { url: "https://www.ah.nl/p9", name: "AH Avocado XL", price: 1.29, currency: "EUR" },
    ];
    const onChoice = vi.fn();
    const { result } = render(onChoice);

    act(() => result.current.ask());
    act(() => result.current.onTermInput("avo"));
    const row = result.current.shopRows[0];

    act(() => result.current.takeTapped(row));

    expect(onChoice).toHaveBeenLastCalledWith(row.choice);
    expect(result.current.manualPrice).toBe("1.29");
  });

  it("does nothing without a Store, and starts over when the Store changes", () => {
    const onChoice = vi.fn();
    const { result, rerender } = renderHook(
      (props: { store: StoreDto | null }) =>
        useProductField({
          store: props.store,
          groceryName: "avocado",
          linkedProduct: null,
          choice: null,
          onChoice,
          locale: "en",
          packWords: words,
        }),
      { initialProps: { store: null as StoreDto | null } }
    );

    expect(result.current.pointsAtShop).toBe(false);
    rerender({ store });
    act(() => result.current.editPrice("2"));
    expect(result.current.manualPrice).toBe("2");
    rerender({ store: { ...store, id: "s2" } });

    expect(result.current.manualPrice).toBe("");
  });
});
