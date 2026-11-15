import { describe, expect, it } from "vitest";

import type { ResolvedProductLink, StoreProductDto } from "@norish/shared/contracts";

import type { PricedLine } from "../store-total";
import { priceOfLink } from "../use-grocery-price";

const line: PricedLine = {
  storeId: "s",
  ingredientId: "i",
  name: "kaas",
  isDone: false,
  amounts: [{ amount: 2, unit: null, purchaseAmount: null }],
};

function link(product: Partial<StoreProductDto> | null, triedAt: Date | null): ResolvedProductLink {
  return {
    storeId: "s",
    ingredientId: "i",
    triedAt,
    suggestion: null,
    product:
      product && ({ price: 2, regularPrice: null, currency: "EUR", ...product } as StoreProductDto),
  };
}

describe("priceOfLink", () => {
  it("says nothing for a food the Store was never asked about, and for a Miss", () => {
    expect(priceOfLink(line, null).status).toBe("none");
    expect(priceOfLink(line, link(null, new Date())).status).toBe("none");
  });

  it("waits for a Pending Link", () => {
    expect(priceOfLink(line, link(null, null)).status).toBe("pending");
  });

  it("prices the packs at the shelf price, and the regular cost on a Sale", () => {
    const priced = priceOfLink(line, link({ price: 2, regularPrice: 3 }, new Date()));

    expect(priced).toMatchObject({ status: "priced", cost: { cost: 4 }, regularCost: 6 });
    expect(priceOfLink(line, link({ price: 2 }, new Date()))).toMatchObject({ regularCost: null });
  });
});
