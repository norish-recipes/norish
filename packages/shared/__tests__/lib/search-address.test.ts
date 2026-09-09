import { describe, expect, it } from "vitest";

import {
  deriveSearchAddress,
  isSearchAddress,
  resolveSearchAddress,
  SEARCH_ADDRESS_PLACEHOLDER,
} from "@norish/shared/lib/search-address";

/** The Search Address a paste derives, or null when it derived none. */
function addressOf(pasted: string): string | null {
  const derived = deriveSearchAddress(pasted);

  return derived?.kind === "address" ? derived.searchAddress : null;
}

describe("deriveSearchAddress: the shops we happen to know", () => {
  it("takes the query parameter of an Albert Heijn search, whatever was searched for", () => {
    expect(addressOf("https://www.ah.nl/zoeken?query=test")).toBe(
      "https://www.ah.nl/zoeken?query={query}"
    );
    expect(addressOf("https://www.ah.nl/zoeken?query=kaas")).toBe(
      "https://www.ah.nl/zoeken?query={query}"
    );
  });

  it("takes the trailing path segment of a Dirk search", () => {
    expect(addressOf("https://www.dirk.nl/zoeken/producten/test")).toBe(
      "https://www.dirk.nl/zoeken/producten/{query}"
    );
    expect(addressOf("https://www.dirk.nl/zoeken/producten/kaas")).toBe(
      "https://www.dirk.nl/zoeken/producten/{query}"
    );
  });

  it("keeps an address that already carries the slot", () => {
    expect(addressOf("https://www.ah.nl/zoeken?query={query}")).toBe(
      "https://www.ah.nl/zoeken?query={query}"
    );
    expect(addressOf("https://www.dirk.nl/zoeken/producten/{query}")).toBe(
      "https://www.dirk.nl/zoeken/producten/{query}"
    );
  });
});

describe("deriveSearchAddress: a search form's own words are not the term", () => {
  it("does not take a mode word a form wrote for the word a person typed", () => {
    // `searchType=keyword` is the form talking to itself; the term is the
    // other value. A four-letter term beside another parameter is given up on
    // rather than guessed at, and a longer one is taken.
    expect(
      deriveSearchAddress("https://www.jumbo.com/producten/?searchType=keyword&searchTerms=kaas")
    ).toMatchObject({ kind: "website" });
    expect(
      addressOf("https://www.jumbo.com/producten/?searchType=keyword&searchTerms=pindakaas")
    ).toBe("https://www.jumbo.com/producten/?searchType=keyword&searchTerms={query}");
  });
});

describe("deriveSearchAddress: shops whose words this repo has never heard", () => {
  it("finds the slot in a German search parameter", () => {
    expect(addressOf("https://shop.example.de/suche?suchbegriff=k%C3%A4se&seite=1")).toBe(
      "https://shop.example.de/suche?suchbegriff={query}&seite=1"
    );
  });

  it("finds the slot in a French search parameter", () => {
    expect(addressOf("https://shop.example.fr/recherche?recherche=fromage&page=1")).toBe(
      "https://shop.example.fr/recherche?recherche={query}&page=1"
    );
  });

  it("finds the slot in a Polish search parameter", () => {
    expect(addressOf("https://shop.example.pl/szukaj?szukaj=mleko&strona=1")).toBe(
      "https://shop.example.pl/szukaj?szukaj={query}&strona=1"
    );
  });

  it("finds the slot in a Korean search parameter", () => {
    expect(
      addressOf("https://shop.example.kr/search?%EA%B2%80%EC%83%89%EC%96%B4=%EC%B9%98%EC%A6%88")
    ).toBe("https://shop.example.kr/search?%EA%B2%80%EC%83%89%EC%96%B4={query}");
  });

  it("recognises a Cyrillic search term as something a person typed", () => {
    expect(addressOf("https://shop.example.ru/poisk?q=%D1%81%D1%8B%D1%80&page=2")).toBe(
      "https://shop.example.ru/poisk?q={query}&page=2"
    );
  });

  it("recognises a Hangul search term as something a person typed", () => {
    expect(addressOf("https://shop.example.kr/find?term=%EC%B9%98%EC%A6%88&sort=asc")).toBe(
      "https://shop.example.kr/find?term={query}&sort=asc"
    );
  });

  it("finds a term sitting in a trailing path segment", () => {
    expect(addressOf("https://shop.example.no/sok/melk")).toBe(
      "https://shop.example.no/sok/{query}"
    );
  });
});

describe("deriveSearchAddress: pastes that are only a website", () => {
  it("derives nothing from ids, page numbers, sort keys and locale tags", () => {
    const derived = deriveSearchAddress(
      "https://shop.example.com/catalog?id=8391&page=2&sort=asc&lang=nl"
    );

    expect(derived).toEqual({
      kind: "website",
      website: "https://shop.example.com",
    });
  });

  it("derives nothing from a homepage", () => {
    expect(deriveSearchAddress("https://www.ah.nl/")).toEqual({
      kind: "website",
      website: "https://www.ah.nl",
    });
  });

  it("derives nothing from a single-segment path", () => {
    expect(addressOf("https://www.ah.nl/producten")).toBeNull();
  });

  it("derives nothing from a UUID or a boolean", () => {
    expect(
      addressOf("https://shop.example.com/list?ref=6f1a0b6e-6d2d-4f3b-8c9a-2b1f0a9d5e77&fresh=true")
    ).toBeNull();
  });

  it("never templates a value that only repeats a path segment", () => {
    expect(addressOf("https://shop.example.be/nl/winkel/123?taal=nl")).toBeNull();
  });

  it("rejects what is not an http address at all", () => {
    expect(deriveSearchAddress("not a url")).toBeNull();
    expect(deriveSearchAddress("ftp://shop.example.com/zoeken/kaas")).toBeNull();
  });
});

describe("deriveSearchAddress: ranking two values that both look typed", () => {
  it("offers the better-ranked value rather than the first one found", () => {
    expect(addressOf("https://shop.example.it/cerca?ordine=crescente&cerca=formaggio+fresco")).toBe(
      "https://shop.example.it/cerca?ordine=crescente&cerca={query}"
    );
  });
});

describe("deriveSearchAddress: what the paste tells us besides the address", () => {
  it("reports the term the user searched for, so it can be probed with", () => {
    expect(deriveSearchAddress("https://www.ah.nl/zoeken?query=kaas")).toMatchObject({
      kind: "address",
      term: "kaas",
    });
    expect(deriveSearchAddress("https://www.dirk.nl/zoeken/producten/oude%20kaas")).toMatchObject({
      kind: "address",
      term: "oude kaas",
    });
  });

  it("reports no term for an address that already carried the slot", () => {
    expect(deriveSearchAddress("https://www.ah.nl/zoeken?query={query}")).toMatchObject({
      kind: "address",
      term: null,
    });
  });

  it("reports the website beside the address", () => {
    expect(deriveSearchAddress("https://www.ah.nl/zoeken?query=kaas")).toMatchObject({
      website: "https://www.ah.nl",
    });
  });
});

describe("resolveSearchAddress", () => {
  it("URL-encodes the term into the slot", () => {
    expect(resolveSearchAddress("https://www.ah.nl/zoeken?query={query}", "oude kaas")).toBe(
      "https://www.ah.nl/zoeken?query=oude%20kaas"
    );
  });

  it("survives a slash and an ampersand", () => {
    expect(resolveSearchAddress("https://www.dirk.nl/zoeken/producten/{query}", "kaas/melk")).toBe(
      "https://www.dirk.nl/zoeken/producten/kaas%2Fmelk"
    );
    expect(resolveSearchAddress("https://www.ah.nl/zoeken?query={query}", "kaas & melk")).toBe(
      "https://www.ah.nl/zoeken?query=kaas%20%26%20melk"
    );
  });

  it("round-trips the term through the resolved URL", () => {
    const resolved = resolveSearchAddress("https://www.ah.nl/zoeken?query={query}", "kaas & melk");

    expect(new URL(resolved).searchParams.get("query")).toBe("kaas & melk");
  });
});

describe("isSearchAddress", () => {
  it("accepts an http address carrying the slot exactly once", () => {
    expect(isSearchAddress("https://www.ah.nl/zoeken?query={query}")).toBe(true);
  });

  it("rejects an address with no slot, two slots, or the wrong protocol", () => {
    expect(isSearchAddress("https://www.ah.nl/zoeken?query=kaas")).toBe(false);
    expect(isSearchAddress("https://www.ah.nl/{query}/{query}")).toBe(false);
    expect(isSearchAddress("ftp://www.ah.nl/zoeken?query={query}")).toBe(false);
  });
});
