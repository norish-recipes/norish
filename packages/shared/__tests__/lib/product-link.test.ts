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
    expect(orderBySuggestion(OFFERED, null).some((c) => c.suggested)).toBe(false);
  });

  it("puts the ranked products first, most likely first, and marks the best guess", () => {
    const ordered = orderBySuggestion(OFFERED, {
      ranked: [
        { url: "https://shop/b", probability: 0.6 },
        { url: "https://shop/a", probability: 0.3 },
      ],
      best: "https://shop/b",
    });

    expect(ordered.map((c) => c.url)).toEqual([
      "https://shop/b",
      "https://shop/a",
      "https://shop/c",
    ]);
    expect(ordered[0]).toMatchObject({ suggested: true });
    expect(ordered[1]?.suggested).toBeUndefined();
  });

  it("marks nothing when the Decision was not sure enough of a best guess", () => {
    const ordered = orderBySuggestion(OFFERED, {
      ranked: [{ url: "https://shop/c", probability: 0.4 }],
      best: null,
    });

    expect(ordered.map((c) => c.url)).toEqual([
      "https://shop/c",
      "https://shop/a",
      "https://shop/b",
    ]);
    expect(ordered.some((c) => c.suggested)).toBe(false);
  });

  it("ignores a ranking of products the shop no longer offers", () => {
    const ordered = orderBySuggestion(OFFERED, {
      ranked: [{ url: "https://shop/gone", probability: 0.9 }],
      best: "https://shop/gone",
    });

    expect(ordered).toEqual(OFFERED);
  });
});
