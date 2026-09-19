// @vitest-environment node
/**
 * What the picker's choice becomes on the server. The repository is mocked;
 * what is pinned here is which repository call each kind of choice turns into,
 * and that a by-hand price typed over one the shopper made earlier corrects
 * that product rather than adding a second.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { storeProductProcedures } from "../../src/routers/stores/products";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";
import { assertHouseholdAccess } from "../mocks/permissions";
import { stores } from "../mocks/realtime/stores";

const storeProductsRepository = vi.hoisted(() => ({
  createManualProduct: vi.fn(),
  getStoreProductById: vi.fn(),
  listStoreProducts: vi.fn(),
  resolveProductLink: vi.fn(),
  setPackSizeByHand: vi.fn(),
  updateManualProduct: vi.fn(),
  upsertProductLink: vi.fn(),
  upsertReadProduct: vi.fn(),
}));

const storesRepository = vi.hoisted(() => ({
  getStoreById: vi.fn(),
  getStoreOwnerId: vi.fn(),
}));

vi.mock("@norish/db/repositories/store-products", () => storeProductsRepository);
vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/stores", () => import("../mocks/realtime/stores"));
vi.mock("@norish/trpc/routers/stores/pricing", () => ({ priceTheList: vi.fn(async () => []) }));
const lookup = vi.hoisted(() => ({
  searchStore: vi.fn(async () => ({ candidates: [] as unknown[], answered: true })),
}));

vi.mock("@norish/queue/store-lookup/lookup", () => lookup);
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const STORE = "11111111-1111-4111-8111-111111111111";
const MANUAL_ID = "22222222-2222-4222-8222-222222222222";

describe("chooseProduct", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());
  const caller = storeProductProcedures.createCaller(createMockCallerContext(ctx));
  const manualChoice = {
    kind: "manual" as const,
    id: MANUAL_ID,
    name: "Oude kaas",
    price: 6.5,
    currency: "EUR",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storesRepository.getStoreOwnerId.mockResolvedValue(ctx.user.id);
    assertHouseholdAccess.mockResolvedValue(undefined);
    storeProductsRepository.resolveProductLink.mockResolvedValue(null);
  });

  it("writes a Miss for a shopper who unlinks the product", async () => {
    await caller.chooseProduct({ storeId: STORE, name: "oude kaas", choice: { kind: "none" } });

    expect(storeProductsRepository.upsertProductLink).toHaveBeenCalledWith(
      STORE,
      "oude kaas",
      null
    );
    expect(storeProductsRepository.createManualProduct).not.toHaveBeenCalled();
    expect(storeProductsRepository.upsertReadProduct).not.toHaveBeenCalled();
  });

  it("writes the page a shopper gives a by-hand product", async () => {
    storeProductsRepository.getStoreProductById.mockResolvedValue(null);
    storeProductsRepository.createManualProduct.mockResolvedValue({
      id: MANUAL_ID,
      storeId: STORE,
      isManual: true,
    });

    await caller.chooseProduct({
      storeId: STORE,
      name: "oude kaas",
      choice: { ...manualChoice, pageUrl: "https://www.dirk.nl/p/oude-kaas" },
    });

    expect(storeProductsRepository.createManualProduct).toHaveBeenCalledWith(
      expect.objectContaining({ pageUrl: "https://www.dirk.nl/p/oude-kaas" })
    );
  });

  it("creates a by-hand product for a price nobody typed before", async () => {
    storeProductsRepository.getStoreProductById.mockResolvedValue(null);
    storeProductsRepository.createManualProduct.mockResolvedValue({
      id: MANUAL_ID,
      storeId: STORE,
      isManual: true,
    });

    await caller.chooseProduct({ storeId: STORE, name: "oude kaas", choice: manualChoice });

    expect(storeProductsRepository.createManualProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: MANUAL_ID, storeId: STORE, name: "Oude kaas", price: 6.5 })
    );
    expect(storeProductsRepository.updateManualProduct).not.toHaveBeenCalled();
    expect(storeProductsRepository.upsertProductLink).toHaveBeenCalledWith(
      STORE,
      "oude kaas",
      MANUAL_ID
    );
  });

  it("keeps the Sale and the pack of the product a by-hand price corrects", async () => {
    // A shopper who types over a product on Sale is correcting that product,
    // not describing a new one: its regular price, the shop's words for the
    // deal, its size and its pack travel with the correction.
    storeProductsRepository.getStoreProductById.mockResolvedValue(null);
    storeProductsRepository.createManualProduct.mockResolvedValue({
      id: MANUAL_ID,
      storeId: STORE,
      isManual: true,
    });

    await caller.chooseProduct({
      storeId: STORE,
      name: "geitenkaas",
      choice: {
        ...manualChoice,
        name: "Geitenkaas plakken, 150 g",
        price: 2.19,
        size: "150 g",
        pack: { quantity: 150, unit: "gram", byWeight: false },
        regularPrice: 3.29,
        dealWords: "Weekend actie",
      },
    });

    expect(storeProductsRepository.createManualProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MANUAL_ID,
        size: "150 g",
        pack: { quantity: 150, unit: "gram", byWeight: false },
        regularPrice: 3.29,
        dealWords: "Weekend actie",
      })
    );
  });

  it("corrects the by-hand product the shopper made earlier instead of adding another", async () => {
    // The field hands back the id of the by-hand product it is showing, so a
    // second price for the same name is the same product corrected. Without
    // this a Store's shelf filled with every price a shopper ever typed, and
    // two identical names made the unmistakable rule refuse both.
    storeProductsRepository.getStoreProductById.mockResolvedValue({
      id: MANUAL_ID,
      storeId: STORE,
      isManual: true,
    });
    storeProductsRepository.updateManualProduct.mockResolvedValue({
      id: MANUAL_ID,
      storeId: STORE,
      isManual: true,
      price: 6.5,
    });

    await caller.chooseProduct({ storeId: STORE, name: "oude kaas", choice: manualChoice });

    expect(storeProductsRepository.updateManualProduct).toHaveBeenCalledWith({
      id: MANUAL_ID,
      name: "Oude kaas",
      price: 6.5,
      currency: "EUR",
      size: null,
      pageUrl: null,
    });
    expect(storeProductsRepository.createManualProduct).not.toHaveBeenCalled();
    expect(stores.publish).toHaveBeenCalledWith(
      "productUpdated",
      expect.objectContaining({ product: expect.objectContaining({ id: MANUAL_ID }) }),
      { householdKey: ctx.householdKey }
    );
  });

  it("writes a Pack Size the shopper set as the last word for the chosen product", async () => {
    const PRODUCT = "33333333-3333-4333-8333-333333333333";
    const pack = { quantity: 500, unit: "gram" as const, byWeight: false };

    storeProductsRepository.getStoreProductById.mockResolvedValue({
      id: PRODUCT,
      storeId: STORE,
      isManual: false,
    });
    storeProductsRepository.setPackSizeByHand.mockResolvedValue({ id: PRODUCT, storeId: STORE });

    await caller.chooseProduct({
      storeId: STORE,
      name: "oude kaas",
      choice: { kind: "product", storeProductId: PRODUCT },
      pack,
    });

    expect(storeProductsRepository.setPackSizeByHand).toHaveBeenCalledExactlyOnceWith(
      PRODUCT,
      pack
    );
    expect(stores.publish).toHaveBeenCalledWith(
      "productUpdated",
      expect.objectContaining({ product: expect.objectContaining({ id: PRODUCT }) }),
      { householdKey: ctx.householdKey }
    );
    expect(storeProductsRepository.upsertProductLink).toHaveBeenCalledWith(
      STORE,
      "oude kaas",
      PRODUCT
    );
  });

  it("leaves the Pack Size alone where the field was left alone", async () => {
    const PRODUCT = "33333333-3333-4333-8333-333333333333";

    storeProductsRepository.getStoreProductById.mockResolvedValue({
      id: PRODUCT,
      storeId: STORE,
      isManual: false,
    });

    await caller.chooseProduct({
      storeId: STORE,
      name: "oude kaas",
      choice: { kind: "product", storeProductId: PRODUCT },
    });

    expect(storeProductsRepository.setPackSizeByHand).not.toHaveBeenCalled();
  });

  it("stores a search result's Pack Size with the product it becomes", async () => {
    storesRepository.getStoreById.mockResolvedValue({
      id: STORE,
      website: "https://www.dirk.nl",
      searchAddress: "https://www.dirk.nl/zoeken/producten/{query}",
    });
    storeProductsRepository.upsertReadProduct.mockResolvedValue({ id: MANUAL_ID, storeId: STORE });

    await caller.chooseProduct({
      storeId: STORE,
      name: "oude kaas",
      choice: {
        kind: "candidate",
        candidate: {
          name: "Oude kaas",
          url: "https://www.dirk.nl/boodschappen/kaas/oude-kaas/97752",
          price: 7.99,
          currency: "EUR",
          size: "930 g",
          pack: { quantity: 930, unit: "gram", byWeight: false },
        },
      },
    });

    expect(storeProductsRepository.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "930 g",
        pack: { quantity: 930, unit: "gram", byWeight: false },
      })
    );
  });

  it("stores the Sale a search result presents with the product it becomes", async () => {
    storesRepository.getStoreById.mockResolvedValue({
      id: STORE,
      website: "https://www.dirk.nl",
      searchAddress: "https://www.dirk.nl/zoeken/producten/{query}",
    });
    storeProductsRepository.upsertReadProduct.mockResolvedValue({ id: MANUAL_ID, storeId: STORE });

    await caller.chooseProduct({
      storeId: STORE,
      name: "oude kaas",
      choice: {
        kind: "candidate",
        candidate: {
          name: "Oude kaas",
          url: "https://www.dirk.nl/boodschappen/kaas/oude-kaas/97752",
          price: 1.69,
          currency: "EUR",
          regularPrice: 2.65,
          dealWords: "ACTIE",
        },
      },
    });

    expect(storeProductsRepository.upsertReadProduct).toHaveBeenCalledWith(
      expect.objectContaining({ price: 1.69, regularPrice: 2.65, dealWords: "ACTIE" })
    );
  });

  it("refuses to turn a product read from a page into a by-hand one", async () => {
    storeProductsRepository.getStoreProductById.mockResolvedValue({
      id: MANUAL_ID,
      storeId: STORE,
      isManual: false,
    });
    storeProductsRepository.updateManualProduct.mockResolvedValue(null);

    await expect(
      caller.chooseProduct({ storeId: STORE, name: "oude kaas", choice: manualChoice })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(storeProductsRepository.upsertProductLink).not.toHaveBeenCalled();
  });

  it("takes a search result only from the Store's own shop", async () => {
    storesRepository.getStoreById.mockResolvedValue({
      id: STORE,
      website: "https://www.dirk.nl",
      searchAddress: "https://www.dirk.nl/zoeken/producten/{query}",
    });
    storeProductsRepository.upsertReadProduct.mockResolvedValue({ id: MANUAL_ID, storeId: STORE });
    const candidate = { name: "Oude kaas", price: 7.99, currency: "EUR" };

    // A page of the shop, with or without its www.
    await caller.chooseProduct({
      storeId: STORE,
      name: "oude kaas",
      choice: { kind: "candidate", candidate: { ...candidate, url: "https://dirk.nl/p/97752" } },
    });
    expect(storeProductsRepository.upsertReadProduct).toHaveBeenCalledTimes(1);

    // A page of anything else is not something Norish reads for this household.
    await expect(
      caller.chooseProduct({
        storeId: STORE,
        name: "oude kaas",
        choice: {
          kind: "candidate",
          candidate: { ...candidate, url: "http://localhost:6379/anything" },
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storeProductsRepository.upsertReadProduct).toHaveBeenCalledTimes(1);
  });

  it("refuses a by-hand product that belongs to another Store", async () => {
    storeProductsRepository.getStoreProductById.mockResolvedValue({
      id: MANUAL_ID,
      storeId: "33333333-3333-4333-8333-333333333333",
      isManual: true,
    });

    await expect(
      caller.chooseProduct({ storeId: STORE, name: "oude kaas", choice: manualChoice })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("searchShop", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());
  const caller = storeProductProcedures.createCaller(createMockCallerContext(ctx));
  const offered = [
    { name: "Oude kaas 500 g", url: "https://www.dirk.nl/p/a", price: 7.99, currency: "EUR" },
    { name: "Oude kaas 1 kg", url: "https://www.dirk.nl/p/b", price: 13.99, currency: "EUR" },
    { name: "Jonge kaas", url: "https://www.dirk.nl/p/c", price: 6.49, currency: "EUR" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    storesRepository.getStoreOwnerId.mockResolvedValue(ctx.user.id);
    storesRepository.getStoreById.mockResolvedValue({
      id: STORE,
      searchAddress: "https://www.dirk.nl/zoeken/producten/{query}",
    });
    assertHouseholdAccess.mockResolvedValue(undefined);
    lookup.searchStore.mockResolvedValue({ candidates: offered, answered: true });
    storeProductsRepository.resolveProductLink.mockResolvedValue(null);
  });

  it("offers the shop's answers in the shop's order when the Store holds no suggestion", async () => {
    const result = await caller.searchShop({ storeId: STORE, term: "oude kaas" });

    expect(result).toEqual({ candidates: offered, answered: true });
    expect(storeProductsRepository.resolveProductLink).toHaveBeenCalledWith(STORE, "oude kaas");
  });

  it("orders the offered products by the Decision kept with the Miss, marking the best guess", async () => {
    storeProductsRepository.resolveProductLink.mockResolvedValue({
      storeId: STORE,
      normalizedName: "oude kaas",
      triedAt: new Date(),
      product: null,
      suggestion: {
        ranked: [
          { url: "https://www.dirk.nl/p/b", probability: 0.6 },
          { url: "https://www.dirk.nl/p/a", probability: 0.3 },
        ],
        best: "https://www.dirk.nl/p/b",
      },
    });

    const result = await caller.searchShop({ storeId: STORE, term: "oude kaas" });

    expect(result.candidates.map((candidate) => candidate.url)).toEqual([
      "https://www.dirk.nl/p/b",
      "https://www.dirk.nl/p/a",
      "https://www.dirk.nl/p/c",
    ]);
    expect(result.candidates[0]).toMatchObject({ suggested: true });
    expect(result.candidates.filter((candidate) => candidate.suggested)).toHaveLength(1);
  });

  it("ignores a suggestion once the name is linked: the question it ranked answers for is closed", async () => {
    storeProductsRepository.resolveProductLink.mockResolvedValue({
      storeId: STORE,
      normalizedName: "oude kaas",
      triedAt: new Date(),
      product: { id: "product-1" },
      suggestion: {
        ranked: [{ url: "https://www.dirk.nl/p/c", probability: 0.9 }],
        best: "https://www.dirk.nl/p/c",
      },
    });

    const result = await caller.searchShop({ storeId: STORE, term: "oude kaas" });

    expect(result.candidates).toEqual(offered);
  });
});
