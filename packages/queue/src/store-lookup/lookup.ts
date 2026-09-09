/**
 * What the store lookup queue actually does, with no BullMQ in sight: ask a
 * shop what a grocery name means there, and re-read a Shelf Price that has
 * gone stale. Every outbound request goes through `paceStoreVisit`, which is
 * the only thing standing between a household's shopping list and somebody
 * else's supermarket.
 */
import type {
  ProductReading,
  StoreProductDto,
  StoreProductReadingInput,
} from "@norish/shared/contracts";
import type { PricedCandidate } from "@norish/shared/lib/currency";
import {
  clearPendingLink,
  linkIfUnanswered,
  listStaleProducts,
  noteProductUnreadable,
  resolveProductLink,
  upsertReadProduct,
} from "@norish/db/repositories/store-products";
import { getStoreById } from "@norish/db/repositories/stores";
import { createLogger } from "@norish/shared-server/logger";
import { storeEmitter } from "@norish/shared-server/realtime/stores";
import { chooseUnmistakable } from "@norish/shared/lib/auto-link";
import { pricedCandidates } from "@norish/shared/lib/currency";
import { resolveSearchAddress } from "@norish/shared/lib/search-address";

import { requireQueueApiHandler } from "../api-handlers";
import { paceStoreVisit, visitKey } from "./pace";

const log = createLogger("queue:store-lookup");

/** A Shelf Price older than this is worth asking the shop about again. */
export const SHELF_PRICE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** The moment a Shelf Price read before is worth asking the shop about again. */
export function staleBefore(now: Date = new Date()): Date {
  return new Date(now.getTime() - SHELF_PRICE_MAX_AGE_MS);
}

async function announceLink(householdKey: string, storeId: string, name: string): Promise<void> {
  const link = await resolveProductLink(storeId, name);

  if (link) storeEmitter.emitToHousehold(householdKey, "linkUpdated", { link });
}

function announceProduct(householdKey: string, product: StoreProductDto): void {
  storeEmitter.emitToHousehold(householdKey, "productUpdated", { product });
}

/**
 * What to keep of a product: its own page's reading where the page stated
 * one, else what the results page said about it.
 */
function productReading(
  storeId: string,
  pageUrl: string,
  reading: ProductReading | null,
  fallback: PricedCandidate | null
): StoreProductReadingInput | null {
  const name = reading?.name ?? fallback?.name;
  const price = reading?.price ?? fallback?.price;
  const currency = reading?.currency ?? fallback?.currency;

  if (name === undefined || price === undefined || currency === undefined) return null;
  // The size and its Pack Size travel together: a page that states no size
  // has no pack either, and the results card's reading stands for both.
  const sized = reading?.size ? reading : fallback;
  // A Sale the results card presented outlives a product page that does not
  // restate it: silence about the regular price is not the deal ending. A
  // page that states another price is the deal ending, and the card's Sale
  // does not travel to it.
  const samePrice = reading === null || fallback === null || reading.price === fallback.price;
  const regularPrice = reading?.regularPrice ?? (samePrice ? fallback?.regularPrice : null) ?? null;
  const dealWords = reading?.dealWords ?? (samePrice ? fallback?.dealWords : null) ?? null;

  return {
    storeId,
    name,
    pageUrl,
    price,
    currency,
    size: sized?.size ?? null,
    pack: sized?.pack ?? null,
    regularPrice,
    dealWords,
  };
}

/**
 * Search one Store's own shop for a term, paced. The only way anything in
 * Norish visits a shop's search page: the queue's match jobs and the picker's
 * searches share this, and therefore share one pacing chain per host.
 */
export async function searchStore(
  searchAddress: string,
  term: string
): Promise<{ candidates: PricedCandidate[]; answered: boolean }> {
  const fetchStorePage = requireQueueApiHandler("fetchStorePage");
  const readSearchResults = requireQueueApiHandler("readSearchResults");
  const url = resolveSearchAddress(searchAddress, term);
  const visit = await paceStoreVisit(visitKey(url), () =>
    fetchStorePage(url, (html, at) => pricedCandidates(readSearchResults(html, at)).length === 0)
  );

  if (!visit.html) return { candidates: [], answered: false };

  // Read against the address the shop answered from: a shop that redirects to
  // its `www.` writes its links for that host, and against the asked-for one
  // most of its shelf would resolve elsewhere and go unpriced.
  return {
    candidates: pricedCandidates(readSearchResults(visit.html, visit.url ?? url)),
    answered: true,
  };
}

/**
 * Ask a Store what a grocery name means there. A Miss is what the shop said:
 * it answered, and nothing it answered with is unmistakably the thing asked
 * for. A shop that did not answer at all — down, rate-limiting, or turning
 * the visit away with nothing to render it with — said nothing, and nothing
 * is written for it: the Pending Link the producer wrote goes, the job stops
 * rather than retrying inside itself, and the next view of the list asks
 * again, an hour on at the soonest. A Miss written for that would have priced
 * the name never.
 *
 * Every write here is conditional on nobody having answered the name in the
 * meantime. The check before the visits only saves the shop a trip; the
 * repository's own condition is what keeps a shopper's choice, made while the
 * shop was being read, from being overwritten by the queue.
 */
export async function matchGroceryName(input: {
  storeId: string;
  name: string;
  householdKey: string;
  onStep?: (step: string) => Promise<void>;
}): Promise<{ matched: boolean }> {
  const { storeId, name, householdKey } = input;
  const store = await getStoreById(storeId);
  // Nothing was learned: the Pending Link the producer wrote goes, so the
  // name is unknown again rather than "being asked" for ever.
  const gaveUp = async (): Promise<{ matched: boolean }> => {
    await clearPendingLink(storeId, name);

    return { matched: false };
  };

  if (!store?.searchAddress) return gaveUp();

  // The job is only ever queued for a name the Store did not know. By the time
  // it runs a shopper may have said which product this is — through the
  // grocery panel, or from a housemate's screen — and a shopper's answer is
  // the answer. Asking the shop anyway would cost two visits and end by
  // pointing the grocery at something nobody chose.
  const answered = await resolveProductLink(storeId, name);

  if (answered?.product) {
    log.debug(
      { storeId, groceryName: name },
      "A shopper answered this name while the lookup was queued"
    );

    return { matched: false };
  }

  const fetchStorePage = requireQueueApiHandler("fetchStorePage");
  const readProduct = requireQueueApiHandler("readProduct");

  await input.onStep?.("searching");
  const { candidates, answered: shopAnswered } = await searchStore(store.searchAddress, name);

  if (!shopAnswered) {
    log.info({ storeId, groceryName: name }, "The shop did not answer a lookup");

    return gaveUp();
  }

  const chosen = chooseUnmistakable(candidates, name);

  if (!chosen) {
    log.info(
      { storeId, groceryName: name, candidates: candidates.length },
      "No unmistakable match; a Miss"
    );
    await linkIfUnanswered(storeId, name, null);
    await announceLink(householdKey, storeId, name);

    return { matched: false };
  }

  // The results page names the product; its own page states the price to keep.
  await input.onStep?.("reading-product");
  const page = await paceStoreVisit(visitKey(chosen.url), () => fetchStorePage(chosen.url));
  const reading = productReading(
    storeId,
    chosen.url,
    page.html ? readProduct(page.html, page.url ?? chosen.url) : null,
    chosen
  );

  if (!reading) return gaveUp();

  await input.onStep?.("saving");
  const product = await upsertReadProduct(reading);
  const linked = await linkIfUnanswered(storeId, name, product.id);

  announceProduct(householdKey, product);
  await announceLink(householdKey, storeId, name);
  if (linked) {
    log.info(
      { storeId, groceryName: name, productId: product.id },
      "Linked a grocery name to a Store Product"
    );
  } else {
    log.debug(
      { storeId, groceryName: name },
      "A shopper answered this name while the shop was being read"
    );
  }

  return { matched: linked };
}

/**
 * Re-read the Shelf Prices that have gone stale. A by-hand product is never
 * here: nothing read it, and nothing may overwrite what its owner typed.
 */
export async function refreshProducts(input: {
  productIds: string[];
  householdKey: string;
  now?: Date;
}): Promise<{ refreshed: number }> {
  const now = input.now ?? new Date();
  const stale = await listStaleProducts(input.productIds, staleBefore(now));

  if (stale.length === 0) return { refreshed: 0 };

  const fetchStorePage = requireQueueApiHandler("fetchStorePage");
  const readProduct = requireQueueApiHandler("readProduct");
  let refreshed = 0;

  for (const product of stale) {
    const pageUrl = product.pageUrl;

    if (!pageUrl) continue;
    const page = await paceStoreVisit(visitKey(pageUrl), () => fetchStorePage(pageUrl));
    const reading = productReading(
      product.storeId,
      pageUrl,
      page.html ? readProduct(page.html, page.url ?? pageUrl) : null,
      null
    );

    if (!reading) {
      log.info({ productId: product.id }, "A stale Shelf Price could not be re-read");
      await noteProductUnreadable(product.id);
      continue;
    }

    const updated = await upsertReadProduct(reading);

    announceProduct(input.householdKey, updated);
    refreshed += 1;
  }

  return { refreshed };
}
