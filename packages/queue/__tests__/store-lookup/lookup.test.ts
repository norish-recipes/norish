// @vitest-environment node
/**
 * What a lookup does with what a shop answers. The reader and the fetcher are
 * the api layer's, reached through the handler registry; what is pinned here
 * is the shape of the visit — one search, an unmistakable match read from its
 * own page, and a Miss written for the searched name and nothing else.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductReading, StoreCandidate } from "@norish/shared/contracts";
import {
  registerQueueApiHandlers,
  resetQueueApiHandlersForTests,
} from "@norish/queue/api-handlers";
import { matchGroceryName, refreshProducts } from "@norish/queue/store-lookup/lookup";
import { resetStoreVisitPacingForTests } from "@norish/queue/store-lookup/pace";

const mocks = vi.hoisted(() => ({
  getStoreById: vi.fn(),
  clearPendingLink: vi.fn(),
  linkIfUnanswered: vi.fn(),
  upsertReadProduct: vi.fn(),
  resolveProductLink: vi.fn(),
  listStaleProducts: vi.fn(),
  noteProductUnreadable: vi.fn(),
  emitToHousehold: vi.fn(),
}));

vi.mock("@norish/db/repositories/stores", () => ({ getStoreById: mocks.getStoreById }));
vi.mock("@norish/db/repositories/store-products", () => ({
  clearPendingLink: mocks.clearPendingLink,
  linkIfUnanswered: mocks.linkIfUnanswered,
  upsertReadProduct: mocks.upsertReadProduct,
  resolveProductLink: mocks.resolveProductLink,
  listStaleProducts: mocks.listStaleProducts,
  noteProductUnreadable: mocks.noteProductUnreadable,
}));
vi.mock("@norish/shared-server/realtime/stores", () => ({
  storeEmitter: { emitToHousehold: mocks.emitToHousehold },
}));

const STORE = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD = "household-1";
const SEARCH_ADDRESS = "https://www.dirk.nl/zoeken/producten/{query}";
const PRODUCT_PAGE = "https://www.dirk.nl/boodschappen/kaas/oude-kaas/97752";

function candidate(name: string, url = PRODUCT_PAGE, price = 7.99): StoreCandidate {
  return { name, url, price, currency: "EUR", size: "930 g" };
}

function useShop(options: {
  searchHtml?: string;
  productHtml?: string;
  candidates?: StoreCandidate[];
  product?: ProductReading | null;
}) {
  const visited: string[] = [];

  registerQueueApiHandlers({
    fetchStorePage: (url: string) => {
      visited.push(url);

      return Promise.resolve({
        html:
          url === PRODUCT_PAGE
            ? (options.productHtml ?? "<html/>")
            : (options.searchHtml ?? "<html/>"),
        url,
        rendered: false,
      });
    },
    readSearchResults: () => options.candidates ?? [],
    readProduct: () => options.product ?? null,
  });

  return visited;
}

describe("matchGroceryName", () => {
  beforeEach(() => {
    resetQueueApiHandlersForTests();
    resetStoreVisitPacingForTests(1);
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getStoreById.mockResolvedValue({ id: STORE, searchAddress: SEARCH_ADDRESS });
    mocks.resolveProductLink.mockResolvedValue({
      storeId: STORE,
      normalizedName: "oude kaas",
      triedAt: new Date(),
      product: null,
    });
    mocks.upsertReadProduct.mockImplementation((reading: Record<string, unknown>) =>
      Promise.resolve({ id: "product-1", ...reading })
    );
    mocks.linkIfUnanswered.mockResolvedValue(true);
  });

  it("searches the shop with the grocery's own name", async () => {
    const visited = useShop({
      candidates: [candidate("Oude kaas")],
      product: { name: "Oude kaas", price: 7.99, currency: "EUR", size: "930 g" },
    });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    expect(visited[0]).toBe("https://www.dirk.nl/zoeken/producten/oude%20kaas");
  });

  it("reads the product's own page for the price it keeps", async () => {
    useShop({
      candidates: [candidate("Oude kaas")],
      product: { name: "1 de Beste Oude kaas 48+", price: 8.49, currency: "EUR", size: "930 g" },
    });

    const result = await matchGroceryName({
      storeId: STORE,
      name: "oude kaas",
      householdKey: HOUSEHOLD,
    });

    expect(result).toEqual({ matched: true });
    expect(mocks.upsertReadProduct).toHaveBeenCalledWith({
      storeId: STORE,
      name: "1 de Beste Oude kaas 48+",
      pageUrl: PRODUCT_PAGE,
      price: 8.49,
      currency: "EUR",
      size: "930 g",
      pack: null,
      regularPrice: null,
      dealWords: null,
    });
    expect(mocks.linkIfUnanswered).toHaveBeenCalledWith(STORE, "oude kaas", "product-1");
  });

  it("keeps the results page's reading when the product page states nothing", async () => {
    useShop({ candidates: [candidate("Oude kaas")], product: null });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    expect(mocks.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({ price: 7.99, name: "Oude kaas" })
    );
  });

  it("keeps the Sale the results card presented when the product page does not restate it", async () => {
    useShop({
      candidates: [{ ...candidate("Oude kaas"), regularPrice: 9.99, dealWords: "ACTIE" }],
      product: { name: "Oude kaas", price: 7.99, currency: "EUR" },
    });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    expect(mocks.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({ price: 7.99, regularPrice: 9.99, dealWords: "ACTIE" })
    );
  });

  it("leaves the card's Sale behind when the product page states another price", async () => {
    useShop({
      candidates: [
        { ...candidate("Oude kaas", PRODUCT_PAGE, 7.99), regularPrice: 9.99, dealWords: "ACTIE" },
      ],
      product: { name: "Oude kaas", price: 8.49, currency: "EUR" },
    });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    // The page is the authority, and the page presented no Sale at €8.49.
    expect(mocks.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({ price: 8.49, regularPrice: null, dealWords: null })
    );
  });

  it("takes the Sale the product page itself presents ahead of the card's", async () => {
    useShop({
      candidates: [{ ...candidate("Oude kaas"), regularPrice: 9.99, dealWords: "ACTIE" }],
      product: {
        name: "Oude kaas",
        price: 7.49,
        currency: "EUR",
        regularPrice: 8.99,
        dealWords: "WEEKEND",
      },
    });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    expect(mocks.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({ price: 7.49, regularPrice: 8.99, dealWords: "WEEKEND" })
    );
  });

  it("stores the Pack Size with the reading, from the page or else from the results card", async () => {
    const grams = { quantity: 930, unit: "gram" as const, byWeight: false };

    useShop({
      candidates: [{ ...candidate("Oude kaas"), pack: grams }],
      product: {
        name: "Oude kaas",
        price: 7.99,
        currency: "EUR",
        size: "1 kg",
        pack: { quantity: 1, unit: "kilogram", byWeight: false },
      },
    });
    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });
    expect(mocks.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "1 kg",
        pack: { quantity: 1, unit: "kilogram", byWeight: false },
      })
    );

    mocks.upsertReadProduct.mockClear();
    useShop({
      candidates: [{ ...candidate("Oude kaas"), pack: grams }],
      product: { name: "Oude kaas", price: 7.99, currency: "EUR" },
    });
    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });
    expect(mocks.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({ size: "930 g", pack: grams })
    );
  });

  it("writes a Miss when nothing on the page is unmistakably the thing asked for", async () => {
    useShop({ candidates: [candidate("Oude kaas 500 g", "a"), candidate("Oude kaas 1 kg", "b")] });

    const result = await matchGroceryName({
      storeId: STORE,
      name: "oude kaas",
      householdKey: HOUSEHOLD,
    });

    expect(result).toEqual({ matched: false });
    expect(mocks.linkIfUnanswered).toHaveBeenCalledWith(STORE, "oude kaas", null);
    expect(mocks.upsertReadProduct).not.toHaveBeenCalled();
  });

  it("links the first of several products carrying exactly the grocery's name", async () => {
    const visited = useShop({
      candidates: [
        candidate("Oude kaas"),
        candidate("Oude kaas", "https://www.dirk.nl/boodschappen/kaas/oude-kaas/97753", 8.49),
      ],
    });

    const result = await matchGroceryName({
      storeId: STORE,
      name: "oude kaas",
      householdKey: HOUSEHOLD,
    });

    expect(result).toEqual({ matched: true });
    expect(visited).toContain(PRODUCT_PAGE);
    expect(mocks.linkIfUnanswered).toHaveBeenCalledWith(STORE, "oude kaas", "product-1");
  });

  // AH lists one loaf under two product numbers: the same name and price at
  // two addresses. That is one product, not a Miss, and its first listing is
  // the page that is read.
  it("links a product the shop lists under two addresses, reading the first", async () => {
    const visited = useShop({
      candidates: [
        candidate("Oude kaas"),
        candidate("Oude kaas", "https://www.dirk.nl/boodschappen/kaas/oude-kaas/97753"),
      ],
    });

    const result = await matchGroceryName({
      storeId: STORE,
      name: "oude kaas",
      householdKey: HOUSEHOLD,
    });

    expect(result).toEqual({ matched: true });
    expect(visited).toContain(PRODUCT_PAGE);
    expect(visited).not.toContain("https://www.dirk.nl/boodschappen/kaas/oude-kaas/97753");
    expect(mocks.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({ pageUrl: PRODUCT_PAGE })
    );
    expect(mocks.linkIfUnanswered).toHaveBeenCalledWith(STORE, "oude kaas", "product-1");
  });

  it("writes nothing and stops when the shop does not answer, so the name is asked again", async () => {
    // A shop that is down, rate-limiting, or turned the visit away has said
    // nothing about the name. A Miss written for that would have priced the
    // name never; with no link the next view of the list asks again.
    registerQueueApiHandlers({
      fetchStorePage: (url: string) => Promise.resolve({ html: "", url, rendered: false }),
      readSearchResults: () => [],
      readProduct: () => null,
    });

    const result = await matchGroceryName({
      storeId: STORE,
      name: "oude kaas",
      householdKey: HOUSEHOLD,
    });

    expect(result).toEqual({ matched: false });
    expect(mocks.linkIfUnanswered).not.toHaveBeenCalled();
    expect(mocks.emitToHousehold).not.toHaveBeenCalled();
    // The Pending Link the producer wrote goes with it: the name is unknown
    // again, rather than "being asked" for ever.
    expect(mocks.clearPendingLink).toHaveBeenCalledExactlyOnceWith(STORE, "oude kaas");
  });

  it("leaves the Pending Link to become the Miss the shop answered with", async () => {
    useShop({ candidates: [candidate("Oude kaas 500 g", "a"), candidate("Oude kaas 1 kg", "b")] });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    // The conditional write turns the pending row into the Miss; nothing
    // deletes it first, or the household would see the row go blank between.
    expect(mocks.clearPendingLink).not.toHaveBeenCalled();
    expect(mocks.linkIfUnanswered).toHaveBeenCalledExactlyOnceWith(STORE, "oude kaas", null);
  });

  it("leaves alone a name somebody answered while the job was queued", async () => {
    // The job is only ever queued for a name the Store did not know. By the
    // time it runs a shopper may have said which product this is — and a
    // shopper's answer is the answer.
    mocks.resolveProductLink.mockResolvedValue({
      storeId: STORE,
      normalizedName: "oude kaas",
      triedAt: new Date(),
      product: { id: "the-shoppers-choice", name: "Roomboter 250 g" },
    });
    const visited = useShop({ candidates: [candidate("Oude kaas")] });

    const result = await matchGroceryName({
      storeId: STORE,
      name: "oude kaas",
      householdKey: HOUSEHOLD,
    });

    expect(result).toEqual({ matched: false });
    expect(mocks.linkIfUnanswered).not.toHaveBeenCalled();
    expect(mocks.upsertReadProduct).not.toHaveBeenCalled();
    // And it costs the shop nothing: the question was already answered.
    expect(visited).toEqual([]);
  });

  it("does not overrule a shopper who answered while the shop was being read", async () => {
    // The check before the visits saw nothing; between the two paced visits a
    // shopper chose the product. The write itself carries the condition, so
    // the repository refuses it — and the job reports that it linked nothing.
    mocks.linkIfUnanswered.mockResolvedValue(false);
    useShop({
      candidates: [candidate("Oude kaas")],
      product: { name: "Oude kaas", price: 7.99, currency: "EUR" },
    });

    const result = await matchGroceryName({
      storeId: STORE,
      name: "oude kaas",
      householdKey: HOUSEHOLD,
    });

    expect(result).toEqual({ matched: false });
    expect(mocks.linkIfUnanswered).toHaveBeenCalledExactlyOnceWith(STORE, "oude kaas", "product-1");
    // Whatever the link now says is what the household hears.
    expect(mocks.emitToHousehold).toHaveBeenCalledWith(HOUSEHOLD, "linkUpdated", expect.anything());
  });

  it("writes a Miss only where nobody has answered", async () => {
    useShop({ candidates: [candidate("Oude kaas 500 g", "a"), candidate("Oude kaas 1 kg", "b")] });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    // The conditional write, never the unconditional one: a Miss found by the
    // queue must not erase a product a shopper picked in the meantime.
    expect(mocks.linkIfUnanswered).toHaveBeenCalledExactlyOnceWith(STORE, "oude kaas", null);
  });

  it("still answers a name the Store knows only as a Miss", async () => {
    mocks.resolveProductLink.mockResolvedValue({
      storeId: STORE,
      normalizedName: "oude kaas",
      triedAt: new Date(),
      product: null,
    });
    useShop({
      candidates: [candidate("Oude kaas")],
      product: { name: "Oude kaas", price: 7.99, currency: "EUR" },
    });

    await expect(
      matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD })
    ).resolves.toEqual({ matched: true });
  });

  it("visits nothing at all for a Store with no Search Address", async () => {
    mocks.getStoreById.mockResolvedValue({ id: STORE, searchAddress: null });
    const visited = useShop({ candidates: [candidate("Oude kaas")] });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    expect(visited).toEqual([]);
    expect(mocks.linkIfUnanswered).not.toHaveBeenCalled();
    // Nothing can be asked, so nothing is left saying it is being asked.
    expect(mocks.clearPendingLink).toHaveBeenCalledWith(STORE, "oude kaas");
  });

  it("tells the household what it learned", async () => {
    useShop({
      candidates: [candidate("Oude kaas")],
      product: { name: "Oude kaas", price: 7.99, currency: "EUR" },
    });

    await matchGroceryName({ storeId: STORE, name: "oude kaas", householdKey: HOUSEHOLD });

    expect(mocks.emitToHousehold).toHaveBeenCalledWith(
      HOUSEHOLD,
      "productUpdated",
      expect.objectContaining({ product: expect.objectContaining({ id: "product-1" }) })
    );
    expect(mocks.emitToHousehold).toHaveBeenCalledWith(HOUSEHOLD, "linkUpdated", expect.anything());
  });
});

describe("refreshProducts", () => {
  beforeEach(() => {
    resetQueueApiHandlersForTests();
    resetStoreVisitPacingForTests(1);
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.upsertReadProduct.mockImplementation((reading: Record<string, unknown>) =>
      Promise.resolve({ id: "product-1", ...reading })
    );
  });

  it("visits nothing when nothing is stale", async () => {
    mocks.listStaleProducts.mockResolvedValue([]);
    const visited = useShop({});

    await expect(refreshProducts({ productIds: ["p1"], householdKey: HOUSEHOLD })).resolves.toEqual(
      {
        refreshed: 0,
      }
    );
    expect(visited).toEqual([]);
  });

  it("re-reads a stale Shelf Price from the page it came from", async () => {
    mocks.listStaleProducts.mockResolvedValue([
      { id: "p1", storeId: STORE, pageUrl: PRODUCT_PAGE, isManual: false },
    ]);
    const visited = useShop({ product: { name: "Oude kaas", price: 8.99, currency: "EUR" } });

    await expect(refreshProducts({ productIds: ["p1"], householdKey: HOUSEHOLD })).resolves.toEqual(
      {
        refreshed: 1,
      }
    );
    expect(visited).toEqual([PRODUCT_PAGE]);
    expect(mocks.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({ price: 8.99, pageUrl: PRODUCT_PAGE })
    );
  });

  it("notes a page it could not re-read, keeping the price it had", async () => {
    mocks.listStaleProducts.mockResolvedValue([
      { id: "p1", storeId: STORE, pageUrl: PRODUCT_PAGE, isManual: false },
    ]);
    useShop({ product: null });

    await expect(refreshProducts({ productIds: ["p1"], householdKey: HOUSEHOLD })).resolves.toEqual(
      { refreshed: 0 }
    );
    // The attempt is noted so a dead page takes its turn behind live ones;
    // nothing is written over the price the page last stated.
    expect(mocks.noteProductUnreadable).toHaveBeenCalledWith("p1");
    expect(mocks.upsertReadProduct).not.toHaveBeenCalled();
  });

  it("asks only for products the repository calls stale, which is never a by-hand one", async () => {
    mocks.listStaleProducts.mockResolvedValue([]);

    await refreshProducts({ productIds: ["manual-1"], householdKey: HOUSEHOLD, now: new Date() });

    expect(mocks.listStaleProducts).toHaveBeenCalledWith(["manual-1"], expect.any(Date));
    expect(mocks.upsertReadProduct).not.toHaveBeenCalled();
  });
});
