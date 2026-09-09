// @vitest-environment node
/**
 * The auto-link rule. It links only where a human would not hesitate, because
 * the one outcome worth avoiding at any cost is being quietly shown the price
 * of the wrong thing.
 */
import { describe, expect, it } from "vitest";

import type { StoreCandidate } from "@norish/shared/contracts";
import { chooseUnmistakable, distinctProducts } from "@norish/shared/lib/auto-link";

function candidate(name: string, url = name, price = 1, size?: string): StoreCandidate {
  return {
    name,
    url: `https://shop.example.nl/p/${encodeURIComponent(url)}`,
    price,
    currency: "EUR",
    ...(size ? { size } : {}),
  };
}

describe("chooseUnmistakable", () => {
  it("links a candidate whose name is the grocery's name", () => {
    const chosen = chooseUnmistakable(
      [candidate("Halfvolle melk 1L"), candidate("Oude kaas"), candidate("Roomboter")],
      "oude  KAAS!"
    );

    expect(chosen?.name).toBe("Oude kaas");
  });

  it("links a candidate whose name holds every word of the grocery's, when only one does", () => {
    const chosen = chooseUnmistakable(
      [candidate("Halfvolle melk 1L"), candidate("Melkchocolade reep"), candidate("Roomboter")],
      "melk"
    );

    expect(chosen?.name).toBe("Halfvolle melk 1L");
  });

  it("links nothing when the words appear in two candidates", () => {
    expect(
      chooseUnmistakable([candidate("Halfvolle melk 1L"), candidate("Volle melk 1L")], "melk")
    ).toBeNull();
  });

  // A name that matches to the letter is the thing asked for, however many
  // listings carry it; the first, in the shop's own order, is the one taken.
  it("takes the first of several products carrying exactly the grocery's name", () => {
    expect(
      chooseUnmistakable(
        [
          candidate("Jonge kaas"),
          candidate("Oude kaas", "a", 4.99),
          candidate("Oude kaas", "b", 5.49),
        ],
        "oude kaas"
      )?.url
    ).toBe("https://shop.example.nl/p/a");
    expect(
      chooseUnmistakable(
        [candidate("Oude kaas", "a", 4.99, "500 g"), candidate("Oude kaas", "b", 4.99, "1 kg")],
        "oude kaas"
      )?.url
    ).toBe("https://shop.example.nl/p/a");
  });

  it("links nothing when the grocery's words sit inside two names and equal neither", () => {
    expect(
      chooseUnmistakable(
        [candidate("Oude kaas 500 g", "a"), candidate("Oude kaas 1 kg", "b")],
        "oude kaas"
      )
    ).toBeNull();
  });

  // AH lists one loaf under two product numbers: the same name, the same
  // price, two addresses. A shopper would not hesitate, and neither does this.
  it("links the one product a shop lists under two addresses", () => {
    const chosen = chooseUnmistakable(
      [
        candidate("Les pains boulogne heel", "wi446406"),
        candidate("Les pains boulogne heel", "wi125035"),
      ],
      "les pains boulogne heel"
    );

    expect(chosen?.url).toBe("https://shop.example.nl/p/wi446406");
  });

  it("counts a product listed twice once when holding the grocery's words against it", () => {
    const chosen = chooseUnmistakable(
      [
        candidate("Halfvolle melk 1L", "a"),
        candidate("Halfvolle melk 1L", "b"),
        candidate("Roomboter"),
      ],
      "melk"
    );

    expect(chosen?.url).toBe("https://shop.example.nl/p/a");
  });

  it("links nothing when a word of the grocery's name is missing", () => {
    expect(chooseUnmistakable([candidate("Halfvolle melk 1L")], "oude melk")).toBeNull();
  });

  it("links nothing out of nothing", () => {
    expect(chooseUnmistakable([], "melk")).toBeNull();
    expect(chooseUnmistakable([candidate("Melk")], "   ")).toBeNull();
  });

  it("folds diacritics and punctuation on both sides", () => {
    expect(chooseUnmistakable([candidate("Crème fraîche 200g")], "creme fraiche")?.name).toBe(
      "Crème fraîche 200g"
    );
  });
});

describe("distinctProducts", () => {
  it("keeps one of a product listed under two addresses, the first", () => {
    const kept = distinctProducts([
      candidate("Oude kaas", "a"),
      candidate("Oude kaas", "b"),
      candidate("Jonge kaas"),
    ]);

    expect(kept.map((product) => product.url)).toEqual([
      "https://shop.example.nl/p/a",
      "https://shop.example.nl/p/Jonge%20kaas",
    ]);
  });

  it("keeps both of a name that comes at two prices or in two sizes", () => {
    expect(
      distinctProducts([candidate("Oude kaas", "a", 4.99), candidate("Oude kaas", "b", 5.49)])
    ).toHaveLength(2);
    expect(
      distinctProducts([
        candidate("Oude kaas", "a", 4.99, "500 g"),
        candidate("Oude kaas", "b", 4.99, "1 kg"),
      ])
    ).toHaveLength(2);
  });

  it("lets a preferred listing stand for its twins, in the place of the first", () => {
    const kept = distinctProducts(
      [candidate("Oude kaas", "a"), candidate("Jonge kaas"), candidate("Oude kaas", "b")],
      (product) => product.url.endsWith("/b")
    );

    expect(kept.map((product) => product.url)).toEqual([
      "https://shop.example.nl/p/b",
      "https://shop.example.nl/p/Jonge%20kaas",
    ]);
  });

  it("reads a name the way the auto-link rule does, so the two never disagree", () => {
    expect(
      distinctProducts([candidate("Oude Kaas!", "a"), candidate("oude  kaas", "b")])
    ).toHaveLength(1);
  });
});
