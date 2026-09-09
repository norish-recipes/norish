// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { discoverSearchAddress, verifySearchAddress } from "@norish/api/parser/store-search";

const visitPage = vi.hoisted(() =>
  vi.fn<(url: string, isEmptyHanded?: (html: string) => boolean) => Promise<{ html: string }>>()
);

vi.mock("@norish/api/parser/store-fetch", () => ({ fetchStorePage: visitPage }));

function page(body: string): string {
  return `<html><head><title>Sklep</title></head><body>${body}</body></html>`;
}

const A_RESULTS_PAGE = page(
  ["1", "2", "3", "4"]
    .map((n) => `<a href="/produkty/produkt/${n}/ser">Ser ${n} 12,3${n} zł</a>`)
    .join("")
);

describe("a shop that answers from another address than it was asked at", () => {
  it("reads the results against the address the shop answered from", async () => {
    // Absolute links for the `www.` host: read against the bare host they were
    // asked at, every one of them is another site's and nothing is priced.
    const html = page(
      ["1", "2", "3", "4"]
        .map(
          (n) =>
            `<a href="https://www.sklep.example.pl/produkty/produkt/${n}/ser">Ser ${n} 12,3${n} zł</a>`
        )
        .join("")
    );

    visitPage.mockResolvedValue({ html, url: "https://www.sklep.example.pl/szukaj?szukaj=ser" });

    await expect(
      verifySearchAddress("https://sklep.example.pl/szukaj?szukaj={query}", "ser")
    ).resolves.toEqual({ outcome: "products", count: 4 });
  });
});

describe("verifySearchAddress", () => {
  beforeEach(() => {
    visitPage.mockReset();
  });

  it("probes with the term the user's own paste carried", async () => {
    visitPage.mockResolvedValue({ html: A_RESULTS_PAGE });

    const check = await verifySearchAddress(
      "https://sklep.example.pl/szukaj?szukaj={query}",
      "ser"
    );

    expect(visitPage.mock.calls[0]?.[0]).toBe("https://sklep.example.pl/szukaj?szukaj=ser");
    expect(check).toEqual({ outcome: "products", count: 4 });
  });

  it("never probes with a word of its own", async () => {
    visitPage.mockResolvedValue({ html: A_RESULTS_PAGE });

    await verifySearchAddress("https://sklep.example.pl/szukaj?szukaj={query}", "mleko");

    for (const [url] of visitPage.mock.calls) {
      expect(url).not.toMatch(/milk|cheese|test/i);
    }
  });

  it("reports a page that answered with nothing it could price", async () => {
    visitPage.mockResolvedValue({ html: page("<p>Brak wyników</p>") });

    await expect(
      verifySearchAddress("https://sklep.example.pl/szukaj?szukaj={query}", "ser")
    ).resolves.toEqual({ outcome: "no-products" });
  });

  it("reports a shop that did not answer at all", async () => {
    visitPage.mockResolvedValue({ html: "" });

    await expect(
      verifySearchAddress("https://sklep.example.pl/szukaj?szukaj={query}", "ser")
    ).resolves.toEqual({ outcome: "no-answer" });
  });

  it("asks only whether the shop answers when no term is known", async () => {
    visitPage.mockResolvedValue({ html: page("<p>Witamy</p>") });

    const check = await verifySearchAddress("https://sklep.example.pl/szukaj?szukaj={query}", null);

    expect(visitPage.mock.calls[0]?.[0]).toBe("https://sklep.example.pl");
    expect(check).toEqual({ outcome: "answered" });
  });
});

describe("discoverSearchAddress", () => {
  beforeEach(() => {
    visitPage.mockReset();
  });

  it("finds the slot in a homepage's own search form", async () => {
    visitPage.mockResolvedValue({
      html: page('<form role="search" action="/szukaj"><input type="text" name="fraza"></form>'),
    });

    await expect(discoverSearchAddress("https://sklep.example.pl/")).resolves.toBe(
      "https://sklep.example.pl/szukaj?fraza={query}"
    );
  });

  it("follows an OpenSearch descriptor to its template", async () => {
    visitPage
      .mockResolvedValueOnce({
        html: `<html><head><link rel="search" type="application/opensearchdescription+xml" href="/os.xml"><title>Sklep</title></head><body></body></html>`,
      })
      .mockResolvedValueOnce({
        html: `<OpenSearchDescription><Url type="text/html" template="https://sklep.example.pl/szukaj?fraza={searchTerms}"/></OpenSearchDescription>`,
      });

    await expect(discoverSearchAddress("https://sklep.example.pl/")).resolves.toBe(
      "https://sklep.example.pl/szukaj?fraza={query}"
    );
  });

  it("reports finding nothing as a normal outcome", async () => {
    visitPage.mockResolvedValue({ html: page("<p>Witamy</p>") });

    await expect(discoverSearchAddress("https://sklep.example.pl/")).resolves.toBeNull();
  });
});
