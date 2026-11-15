import { describe, expect, it } from "vitest";

import type { StoreProductDto } from "@norish/shared/contracts";

import { answers, productRow, selectedKey } from "../product-rows";

const words = {
  per: (unit: string) => `per ${unit}`,
  pieces: (count: number) => `${count} pieces`,
};

describe("product rows", () => {
  it("lets a long word sit inside a name's own but holds a short one to whole words", () => {
    expect(answers("Coca-Cola Zero", "cola")).toBe(true);
    expect(answers("Oude kaas 1 L", "l")).toBe(true);
    expect(answers("Oude kaas", "l")).toBe(false);
    expect(answers("Oude kaas", "")).toBe(true);
  });

  it("names the row a held choice is", () => {
    expect(selectedKey({ kind: "product", storeProductId: "p1" })).toBe("p1");
    expect(selectedKey({ kind: "none" })).toBeNull();
    expect(selectedKey(null)).toBeNull();
  });

  it("draws a stored product as a product choice with the shop's size words", () => {
    const product = {
      id: "p1",
      name: "AH Avocado",
      price: 0.99,
      currency: "EUR",
      size: "per stuk",
      pageUrl: null,
      regularPrice: 1.49,
      dealWords: null,
    } as unknown as StoreProductDto;
    const row = productRow(product, words);

    expect(row.choice).toEqual({ kind: "product", storeProductId: "p1" });
    expect(row.packWords).toBe("per stuk");
    expect(row.regularPrice).toBe(1.49);
  });
});
