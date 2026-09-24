import { describe, expect, it } from "vitest";

import type { StoreCandidate } from "@norish/shared/contracts";
import { isPendingLink, orderBySuggestion, pendingLink } from "@norish/shared/lib/product-link";

function candidate(name: string, url: string): StoreCandidate {
  return { name, url, price: 1, currency: "EUR" };
}

const OFFERED = [
  candidate("Oude kaas 500 g", "https://shop/a"),
  candidate("Oude kaas 1 kg", "https://shop/b"),
  candidate("Jonge kaas", "https://shop/c"),
];

describe("pendingLink", () => {
  it("is a Pending Link with nothing suggested yet", () => {
    const link = pendingLink("store-1", "Oude Kaas");

    expect(link).toEqual({
      storeId: "store-1",
      normalizedName: "oude kaas",
      triedAt: null,
      product: null,
      suggestion: null,
    });
    expect(isPendingLink(link)).toBe(true);
  });
});

describe("orderBySuggestion", () => {
  it("leaves the shop's order untouched without a suggestion", () => {
    expect(orderBySuggestion(OFFERED, null)).toEqual(OFFERED);
    expect(orderBySuggestion(OFFERED, undefined)).toEqual(OFFERED);
  });

  it("puts the ranked products first, most likely first, the rest in the shop's order", () => {
    const ordered = orderBySuggestion(OFFERED, {
      ranked: [
        { url: "https://shop/b", probability: 0.4 },
        { url: "https://shop/a", probability: 0.3 },
      ],
    });

    expect(ordered.map((c) => c.url)).toEqual([
      "https://shop/b",
      "https://shop/a",
      "https://shop/c",
    ]);
    // Nothing is marked: the order is the whole suggestion.
    expect(ordered).toEqual([OFFERED[1], OFFERED[0], OFFERED[2]]);
  });

  it("ignores a ranking of products the shop no longer offers", () => {
    const ordered = orderBySuggestion(OFFERED, {
      ranked: [{ url: "https://shop/gone", probability: 0.9 }],
    });

    expect(ordered).toEqual(OFFERED);
  });
});
