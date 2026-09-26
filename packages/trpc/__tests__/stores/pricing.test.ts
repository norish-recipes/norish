// @vitest-environment node
/**
 * Pricing a list: what the household's Stores know about each grocery's
 * Ingredient is read back, and what they do not know is asked — with a Pending
 * Link written first, so every screen sees the question being asked, and the
 * job second (ADR-0037).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MATCH_RETRY_WINDOW_MS } from "@norish/queue/store-lookup/producer";

import { noticeGroceries, priceTheList } from "../../src/routers/stores/pricing";
import { stores } from "../mocks/realtime/stores";

const storeProductsRepository = vi.hoisted(() => ({
  resolveProductLinks: vi.fn(),
  markLinkPending: vi.fn(),
  listStaleProducts: vi.fn(async () => []),
}));
const storesRepository = vi.hoisted(() => ({ listStoresByUserIds: vi.fn() }));
const groceriesRepository = vi.hoisted(() => ({ listGroceriesByUsers: vi.fn(async () => []) }));
const queue = vi.hoisted(() => ({ add: vi.fn(async () => undefined) }));

vi.mock("@norish/db/repositories/store-products", () => storeProductsRepository);
vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock("@norish/db/repositories/groceries", () => groceriesRepository);
vi.mock("@norish/queue/registry", () => ({ getQueues: () => ({ storeLookup: queue }) }));
vi.mock("@norish/shared-server/realtime/stores", () => import("../mocks/realtime/stores"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const STORE = "11111111-1111-4111-8111-111111111111";
const ctx = { userIds: ["user-1"], householdKey: "household-1" };
const searchable = { id: STORE, searchAddress: "https://shop.example.nl/zoeken?q={query}" };

/** A grocery at the Store whose name resolved to the Ingredient named for its lowercase self. */
function grocery(name: string, ingredientId = `ingredient:${name.toLowerCase()}`) {
  return { name, storeId: STORE, ingredientId };
}

describe("asking a Store what an Ingredient means", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storesRepository.listStoresByUserIds.mockResolvedValue([searchable]);
    storeProductsRepository.resolveProductLinks.mockResolvedValue([]);
    storeProductsRepository.markLinkPending.mockResolvedValue(true);
  });

  it("writes a Pending Link, then the job, and tells the household there and then", async () => {
    const links = await noticeGroceries(ctx, [grocery("Oude kaas")]);

    // The row before the job: the row is what says "being asked", and a job
    // BullMQ refuses as a duplicate must still have a row behind it.
    expect(storeProductsRepository.markLinkPending).toHaveBeenCalledExactlyOnceWith(
      STORE,
      "ingredient:oude kaas",
      expect.any(Date)
    );
    expect(storeProductsRepository.markLinkPending.mock.invocationCallOrder[0]).toBeLessThan(
      queue.add.mock.invocationCallOrder[0]!
    );
    expect(queue.add).toHaveBeenCalledExactlyOnceWith(
      "match",
      {
        kind: "match",
        storeId: STORE,
        ingredientId: "ingredient:oude kaas",
        name: "Oude kaas",
        householdKey: "household-1",
      },
      expect.not.objectContaining({ delay: expect.anything() })
    );

    const pending = {
      storeId: STORE,
      ingredientId: "ingredient:oude kaas",
      triedAt: null,
      product: null,
      suggestion: null,
    };

    expect(links).toEqual([pending]);
    expect(stores.publish).toHaveBeenCalledWith(
      "linkUpdated",
      {
        link: pending,
      },
      { householdKey: "household-1" }
    );
  });

  it("tells the household about a question the list view asked, and about nothing it already knew", async () => {
    const miss = {
      storeId: STORE,
      ingredientId: "ingredient:melk",
      triedAt: new Date(),
      product: null,
    };

    groceriesRepository.listGroceriesByUsers.mockResolvedValue([grocery("kaas"), grocery("melk")]);
    storeProductsRepository.resolveProductLinks.mockResolvedValue([miss]);

    const links = await priceTheList(ctx);
    const pending = {
      storeId: STORE,
      ingredientId: "ingredient:kaas",
      triedAt: null,
      product: null,
      suggestion: null,
    };

    expect(links).toEqual([miss, pending]);
    expect(stores.publish).toHaveBeenCalledExactlyOnceWith(
      "linkUpdated",
      { link: pending },
      { householdKey: "household-1" }
    );
  });

  it("asks again only for a Pending Link older than the retry window", async () => {
    const before = Date.now();

    await priceTheList(ctx);
    groceriesRepository.listGroceriesByUsers.mockResolvedValue([grocery("kaas")]);
    await priceTheList(ctx);

    const askedBefore = storeProductsRepository.markLinkPending.mock.calls[0]?.[2] as Date;

    expect(askedBefore.getTime()).toBeGreaterThanOrEqual(before - MATCH_RETRY_WINDOW_MS);
    expect(askedBefore.getTime()).toBeLessThanOrEqual(Date.now() - MATCH_RETRY_WINDOW_MS);
  });

  it("leaves a fresh Pending Link to the job already asking, and still reports it", async () => {
    const pending = {
      storeId: STORE,
      ingredientId: "ingredient:kaas",
      triedAt: null,
      product: null,
      suggestion: null,
    };

    storeProductsRepository.resolveProductLinks.mockResolvedValue([pending]);
    // The repository refuses to re-stamp a row younger than the window.
    storeProductsRepository.markLinkPending.mockResolvedValue(false);

    const links = await noticeGroceries(ctx, [grocery("kaas")]);

    expect(queue.add).not.toHaveBeenCalled();
    expect(links).toEqual([pending]);
  });

  it("asks again for a Pending Link a dead worker left behind, without listing it twice", async () => {
    const stale = {
      storeId: STORE,
      ingredientId: "ingredient:kaas",
      triedAt: null,
      product: null,
      suggestion: null,
    };

    storeProductsRepository.resolveProductLinks.mockResolvedValue([stale]);
    storeProductsRepository.markLinkPending.mockResolvedValue(true);

    const links = await noticeGroceries(ctx, [grocery("kaas")]);

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(links).toEqual([stale]);
  });

  it("asks nothing about an Ingredient the Store answered, Miss or match", async () => {
    storeProductsRepository.resolveProductLinks.mockResolvedValue([
      { storeId: STORE, ingredientId: "ingredient:kaas", triedAt: new Date(), product: null },
    ]);

    await noticeGroceries(ctx, [grocery("kaas")]);

    expect(storeProductsRepository.markLinkPending).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("asks nothing of a Store with no shop behind it", async () => {
    storesRepository.listStoresByUserIds.mockResolvedValue([{ id: STORE, searchAddress: null }]);

    await noticeGroceries(ctx, [grocery("kaas")]);

    expect(storeProductsRepository.markLinkPending).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("asks once for two spellings of one Ingredient, under the first grocery's name", async () => {
    await noticeGroceries(ctx, [
      grocery("onions, diced", "ingredient:onion"),
      grocery("Uien", "ingredient:onion"),
    ]);

    expect(storeProductsRepository.markLinkPending).toHaveBeenCalledExactlyOnceWith(
      STORE,
      "ingredient:onion",
      expect.any(Date)
    );
    expect(queue.add).toHaveBeenCalledExactlyOnceWith(
      "match",
      expect.objectContaining({ ingredientId: "ingredient:onion", name: "onions, diced" }),
      expect.anything()
    );
  });

  it("asks nothing about a grocery the server has not resolved yet", async () => {
    await noticeGroceries(ctx, [{ name: "kaas", storeId: STORE, ingredientId: null }]);

    expect(storeProductsRepository.markLinkPending).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
