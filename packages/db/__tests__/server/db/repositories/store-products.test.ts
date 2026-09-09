// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  clearPendingLink,
  createManualProduct,
  getStoreProductById,
  linkIfUnanswered,
  listStaleProducts,
  listStoreProducts,
  markLinkPending,
  noteProductUnreadable,
  resolveProductLink,
  resolveProductLinks,
  setPackSizeByHand,
  updateManualProduct,
  upsertProductLink,
  upsertReadProduct,
} from "@norish/db/repositories/store-products";
import { deleteStore } from "@norish/db/repositories/stores";
import { groceries, storeProductLinks, storeProducts, stores } from "@norish/db/schema";

import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const PAGE = "https://www.dirk.nl/boodschappen/zuivel-kaas/kaas-stuk/oude-kaas/97752";
const OTHER_PAGE = "https://www.dirk.nl/boodschappen/zuivel-kaas/kaas-stuk/jonge-kaas/97751";

describe("store products, product links and misses", () => {
  const testBase = new RepositoryTestBase("test_store_products");

  let userId: string;
  let storeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    const [store] = await getTestDb()
      .insert(stores)
      .values({ userId, name: "Dirk", website: "https://www.dirk.nl" })
      .returning();

    storeId = store!.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  function reading(overrides: Partial<Parameters<typeof upsertReadProduct>[0]> = {}) {
    return {
      storeId,
      name: "1 de Beste Jong belegen kaas 48+ stuk",
      pageUrl: PAGE,
      price: 7.99,
      currency: "EUR",
      size: "930 g",
      ...overrides,
    };
  }

  describe("a shop page is one product", () => {
    it("updates the product it already read rather than adding another", async () => {
      const first = await upsertReadProduct(reading());
      const second = await upsertReadProduct(reading({ price: 8.49, size: "930 gram" }));

      expect(second.id).toBe(first.id);
      expect(second.price).toBe(8.49);
      expect(second.size).toBe("930 gram");
      expect(second.pricedAt.getTime()).toBeGreaterThanOrEqual(first.pricedAt.getTime());
      await expect(listStoreProducts(storeId)).resolves.toHaveLength(1);
    });

    it("refuses to hold the same page twice", async () => {
      await upsertReadProduct(reading());

      await expect(
        getTestDb()
          .insert(storeProducts)
          .values({ storeId, name: "Dubbel", pageUrl: PAGE, price: "1.00", currency: "EUR" })
      ).rejects.toThrow();
    });

    it("lets a store hold many by-hand products, which have no page at all", async () => {
      await createManualProduct({
        id: crypto.randomUUID(),
        storeId,
        name: "Kaas van de markt",
        price: 5,
        currency: "EUR",
      });
      await createManualProduct({
        id: crypto.randomUUID(),
        storeId,
        name: "Melk van de boer",
        price: 1.2,
        currency: "EUR",
      });

      const products = await listStoreProducts(storeId);

      expect(products).toHaveLength(2);
      expect(products.every((product) => product.pageUrl === null)).toBe(true);
      expect(products.every((product) => product.isManual)).toBe(true);
    });
  });

  describe("the Pack Size: what one Shelf Price buys", () => {
    const grams = (quantity: number) => ({ quantity, unit: "gram" as const, byWeight: false });

    it("is stored with a reading, and replaced by the next", async () => {
      const first = await upsertReadProduct(reading({ pack: grams(930) }));

      expect(first).toMatchObject({ packQuantity: 930, packUnit: "gram", packByWeight: false });

      const second = await upsertReadProduct(
        reading({ size: "1 kg", pack: { quantity: 1, unit: "kilogram", byWeight: false } })
      );

      expect(second).toMatchObject({ packQuantity: 1, packUnit: "kilogram", packByHand: false });
    });

    it("marks what is sold loose", async () => {
      const loose = await upsertReadProduct(
        reading({ size: "per kg", pack: { quantity: 1, unit: "kilogram", byWeight: true } })
      );

      expect(loose).toMatchObject({ packQuantity: 1, packUnit: "kilogram", packByWeight: true });
    });

    it("is never overwritten by a reading once set by hand, and reads itself again once cleared", async () => {
      const read = await upsertReadProduct(reading({ pack: grams(930) }));

      await expect(setPackSizeByHand(read.id, grams(1000))).resolves.toMatchObject({
        packQuantity: 1000,
        packByHand: true,
      });

      // A refresh reads the page again: the shop's number is not the last word.
      const refreshed = await upsertReadProduct(reading({ price: 8.49, pack: grams(930) }));

      expect(refreshed).toMatchObject({ price: 8.49, packQuantity: 1000, packByHand: true });

      // Cleared, the product says what its own size words say.
      await expect(setPackSizeByHand(read.id, null)).resolves.toMatchObject({
        packQuantity: 930,
        packUnit: "gram",
        packByHand: false,
      });
    });

    it("is taken by a by-hand product too", async () => {
      const manual = await createManualProduct({
        id: crypto.randomUUID(),
        storeId,
        name: "Kaas van de markt",
        price: 5,
        currency: "EUR",
        pack: grams(500),
      });

      expect(manual).toMatchObject({ packQuantity: 500, packUnit: "gram", packByHand: true });
      await expect(
        updateManualProduct({
          id: manual.id,
          pack: { quantity: 250, unit: "gram", byWeight: false },
        })
      ).resolves.toMatchObject({ packQuantity: 250 });
    });
  });

  describe("a Sale lasts until the shop presents another price", () => {
    it("is stored with the reading that presented it", async () => {
      const onSale = await upsertReadProduct(
        reading({ price: 1.69, regularPrice: 2.65, dealWords: "VR, ZA & ZO actie" })
      );

      expect(onSale).toMatchObject({
        price: 1.69,
        regularPrice: 2.65,
        dealWords: "VR, ZA & ZO actie",
      });
    });

    it("survives a refresh that reads the same price and says nothing about the deal", async () => {
      await upsertReadProduct(reading({ price: 1.69, regularPrice: 2.65, dealWords: "ACTIE" }));

      const refreshed = await upsertReadProduct(reading({ price: 1.69 }));

      expect(refreshed).toMatchObject({ price: 1.69, regularPrice: 2.65, dealWords: "ACTIE" });
    });

    it("ends with a refresh that reads any other price", async () => {
      await upsertReadProduct(reading({ price: 1.69, regularPrice: 2.65, dealWords: "ACTIE" }));

      const refreshed = await upsertReadProduct(reading({ price: 2.65 }));

      expect(refreshed).toMatchObject({ price: 2.65, regularPrice: null, dealWords: null });
    });

    it("is what the page presents when the page presents one", async () => {
      await upsertReadProduct(reading({ price: 1.69, regularPrice: 2.65, dealWords: "ACTIE" }));

      const refreshed = await upsertReadProduct(
        reading({ price: 1.49, regularPrice: 2.65, dealWords: "WEEKEND" })
      );

      expect(refreshed).toMatchObject({ price: 1.49, regularPrice: 2.65, dealWords: "WEEKEND" });
    });

    it("never touches a by-hand product", async () => {
      const manual = await createManualProduct({
        id: crypto.randomUUID(),
        storeId,
        name: "Kaas van de markt",
        price: 5,
        currency: "EUR",
      });

      expect(manual).toMatchObject({ regularPrice: null, dealWords: null });
    });
  });

  describe("a by-hand price is the last word", () => {
    it("leaves a by-hand product untouched when a page states otherwise", async () => {
      const manual = await createManualProduct({
        id: crypto.randomUUID(),
        storeId,
        name: "Kaas van de markt",
        price: 5,
        currency: "EUR",
      });

      await getTestDb()
        .update(storeProducts)
        .set({ pageUrl: PAGE })
        .where(eq(storeProducts.id, manual.id));

      const after = await upsertReadProduct(reading());

      expect(after.id).toBe(manual.id);
      expect(after.price).toBe(5);
      expect(after.name).toBe("Kaas van de markt");
    });

    it("refreshes what it has not tried for longest first, and a dead page steps back", async () => {
      const first = await upsertReadProduct(reading());
      const second = await upsertReadProduct(reading({ pageUrl: OTHER_PAGE, name: "Jonge kaas" }));
      const longAgo = new Date("2026-01-01T00:00:00Z");

      await getTestDb()
        .update(storeProducts)
        .set({ pricedAt: longAgo, updatedAt: longAgo })
        .where(eq(storeProducts.id, first.id));
      await getTestDb()
        .update(storeProducts)
        .set({ pricedAt: longAgo, updatedAt: new Date("2026-01-02T00:00:00Z") })
        .where(eq(storeProducts.id, second.id));

      const stale = () =>
        listStaleProducts([first.id, second.id], new Date()).then((rows) =>
          rows.map((row) => row.id)
        );

      await expect(stale()).resolves.toEqual([first.id, second.id]);

      // The first page could not be re-read: its price stays, and it takes
      // its turn behind the one that has waited longer since.
      await noteProductUnreadable(first.id);
      await expect(stale()).resolves.toEqual([second.id, first.id]);
      await expect(getStoreProductById(first.id)).resolves.toMatchObject({ price: 7.99 });
    });

    it("is never stale, because nothing read it", async () => {
      const manual = await createManualProduct({
        id: crypto.randomUUID(),
        storeId,
        name: "Kaas van de markt",
        price: 5,
        currency: "EUR",
      });
      const read = await upsertReadProduct(reading());

      await getTestDb()
        .update(storeProducts)
        .set({ pricedAt: new Date("2020-01-01T00:00:00Z") });

      const stale = await listStaleProducts([manual.id, read.id], new Date());

      expect(stale.map((product) => product.id)).toEqual([read.id]);
    });

    it("can be edited by any household member", async () => {
      const manual = await createManualProduct({
        id: crypto.randomUUID(),
        storeId,
        name: "Kaas van de markt",
        price: 5,
        currency: "EUR",
      });

      const updated = await updateManualProduct({ id: manual.id, price: 5.5, name: "Boerenkaas" });

      expect(updated).toMatchObject({ price: 5.5, name: "Boerenkaas", pageUrl: null });
    });

    it("refuses to edit a product that was read from a page", async () => {
      const read = await upsertReadProduct(reading());

      await expect(updateManualProduct({ id: read.id, price: 1 })).resolves.toBeNull();
    });
  });

  describe("what a Store has learned a name means", () => {
    it("resolves a known name to its product", async () => {
      const product = await upsertReadProduct(reading());

      await upsertProductLink(storeId, "Oude Kaas", product.id);

      const resolved = await resolveProductLink(storeId, "  oude   kaas!  ");

      expect(resolved?.product?.id).toBe(product.id);
      expect(resolved?.normalizedName).toBe("oude kaas");
    });

    it("resolves an unknown name to nothing at all", async () => {
      await expect(resolveProductLink(storeId, "kaas")).resolves.toBeNull();
    });

    it("reads a link with no product as a Miss, holding when it was tried", async () => {
      await upsertProductLink(storeId, "sterrenstof", null);

      const resolved = await resolveProductLink(storeId, "sterrenstof");

      expect(resolved?.product).toBeNull();
      expect(resolved?.triedAt).toBeInstanceOf(Date);
    });

    it("keeps one link per store and name, last writer winning", async () => {
      const first = await upsertReadProduct(reading());
      const second = await upsertReadProduct(reading({ pageUrl: OTHER_PAGE, name: "Jonge kaas" }));

      await upsertProductLink(storeId, "kaas", first.id);
      await upsertProductLink(storeId, "kaas", second.id);

      const links = await getTestDb().select().from(storeProductLinks);

      expect(links).toHaveLength(1);
      await expect(resolveProductLink(storeId, "kaas")).resolves.toMatchObject({
        product: { id: second.id },
      });
    });

    it("lets the queue answer a name nobody has, and only such a name", async () => {
      const read = await upsertReadProduct(reading());

      // Nobody has answered "kaas": the queue's match lands.
      await expect(linkIfUnanswered(storeId, "kaas", read.id)).resolves.toBe(true);
      await expect(resolveProductLink(storeId, "kaas")).resolves.toMatchObject({
        product: { id: read.id },
      });

      // A shopper then chooses another product. The queue, finishing a lookup
      // it started before that, must not overrule them — with a match or with
      // a Miss.
      const chosen = await upsertReadProduct(reading({ pageUrl: OTHER_PAGE, name: "Jonge kaas" }));

      await upsertProductLink(storeId, "kaas", chosen.id);
      await expect(linkIfUnanswered(storeId, "kaas", read.id)).resolves.toBe(false);
      await expect(linkIfUnanswered(storeId, "kaas", null)).resolves.toBe(false);
      await expect(resolveProductLink(storeId, "kaas")).resolves.toMatchObject({
        product: { id: chosen.id },
      });
    });

    it("lets the queue answer a name it only knew as a Miss", async () => {
      await upsertProductLink(storeId, "kaas", null);
      const read = await upsertReadProduct(reading());

      await expect(linkIfUnanswered(storeId, "kaas", read.id)).resolves.toBe(true);
      await expect(resolveProductLink(storeId, "kaas")).resolves.toMatchObject({
        product: { id: read.id },
      });
    });

    it("reads the products of many groceries in one query", async () => {
      const kaas = await upsertReadProduct(reading());
      const melk = await upsertReadProduct(reading({ pageUrl: OTHER_PAGE, name: "Melk" }));

      await upsertProductLink(storeId, "kaas", kaas.id);
      await upsertProductLink(storeId, "melk", melk.id);
      await upsertProductLink(storeId, "sterrenstof", null);

      const resolved = await resolveProductLinks([
        { storeId, name: "Kaas" },
        { storeId, name: "melk" },
        { storeId, name: "sterrenstof" },
        { storeId, name: "boter" },
      ]);

      expect(resolved).toHaveLength(3);
      expect(
        resolved
          .filter((link) => link.product !== null)
          .map((link) => link.normalizedName)
          .sort()
      ).toEqual(["kaas", "melk"]);
    });
  });

  describe("a Pending Link: the Store has been asked and has not answered", () => {
    const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000);

    it("is written for a name nobody has asked about, and reads as neither a link nor a Miss", async () => {
      await expect(markLinkPending(storeId, "Kaas", anHourAgo())).resolves.toBe(true);

      const resolved = await resolveProductLink(storeId, "kaas");

      expect(resolved).toMatchObject({ normalizedName: "kaas", product: null, triedAt: null });
    });

    it("is somebody else's question while it is fresh, and the caller's again once it has gone stale", async () => {
      await markLinkPending(storeId, "kaas", anHourAgo());

      // A second view a moment later finds the question already asked.
      await expect(markLinkPending(storeId, "kaas", anHourAgo())).resolves.toBe(false);

      // A worker that died left the row behind; an hour on it is asked again.
      await expect(markLinkPending(storeId, "kaas", new Date())).resolves.toBe(true);
    });

    it("never overwrites an answer, Miss or match", async () => {
      const read = await upsertReadProduct(reading());

      await upsertProductLink(storeId, "kaas", read.id);
      await upsertProductLink(storeId, "sterrenstof", null);

      await expect(markLinkPending(storeId, "kaas", new Date())).resolves.toBe(false);
      await expect(markLinkPending(storeId, "sterrenstof", new Date())).resolves.toBe(false);
      await expect(resolveProductLink(storeId, "kaas")).resolves.toMatchObject({
        product: { id: read.id },
      });
      await expect(resolveProductLink(storeId, "sterrenstof")).resolves.toMatchObject({
        product: null,
        triedAt: expect.any(Date),
      });
    });

    it("becomes the answer the queue writes, or the one a shopper chooses", async () => {
      const read = await upsertReadProduct(reading());

      await markLinkPending(storeId, "kaas", anHourAgo());
      await expect(linkIfUnanswered(storeId, "kaas", read.id)).resolves.toBe(true);
      await expect(resolveProductLink(storeId, "kaas")).resolves.toMatchObject({
        product: { id: read.id },
        triedAt: expect.any(Date),
      });

      await markLinkPending(storeId, "melk", anHourAgo());
      await linkIfUnanswered(storeId, "melk", null);
      await expect(resolveProductLink(storeId, "melk")).resolves.toMatchObject({
        product: null,
        triedAt: expect.any(Date),
      });

      await markLinkPending(storeId, "boter", anHourAgo());
      await upsertProductLink(storeId, "boter", read.id);
      await expect(resolveProductLink(storeId, "boter")).resolves.toMatchObject({
        product: { id: read.id },
      });
    });

    it("goes when the shop did not answer, and only then", async () => {
      await markLinkPending(storeId, "kaas", anHourAgo());
      await expect(clearPendingLink(storeId, "kaas")).resolves.toBe(true);
      await expect(resolveProductLink(storeId, "kaas")).resolves.toBeNull();

      // A Miss or a link written meanwhile is an answer, and stays.
      await upsertProductLink(storeId, "sterrenstof", null);
      await expect(clearPendingLink(storeId, "sterrenstof")).resolves.toBe(false);
      await expect(resolveProductLink(storeId, "sterrenstof")).resolves.not.toBeNull();
    });
  });

  describe("what a delete takes with it", () => {
    it("takes a Store's products and links with the Store", async () => {
      const product = await upsertReadProduct(reading());

      await upsertProductLink(storeId, "kaas", product.id);
      const [store] = await getTestDb().select().from(stores).where(eq(stores.id, storeId));

      await deleteStore(storeId, store!.version, false, []);

      await expect(getStoreProductById(product.id)).resolves.toBeNull();
      await expect(getTestDb().select().from(storeProductLinks)).resolves.toEqual([]);
    });

    it("takes neither with a Grocery, which is the point of keying by name", async () => {
      const product = await upsertReadProduct(reading());

      await upsertProductLink(storeId, "kaas", product.id);
      const [grocery] = await getTestDb()
        .insert(groceries)
        .values({ userId, storeId, name: "Kaas" })
        .returning();

      await getTestDb().delete(groceries).where(eq(groceries.id, grocery!.id));

      await expect(getStoreProductById(product.id)).resolves.not.toBeNull();
      await expect(resolveProductLink(storeId, "kaas")).resolves.toMatchObject({
        product: { id: product.id },
      });
    });
  });
});
