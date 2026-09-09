import { TRPCError } from "@trpc/server";

import type {
  ResolvedProductLink,
  StoreCandidate,
  StoreProductChoice,
} from "@norish/shared/contracts";
import {
  createManualProduct,
  getStoreProductById,
  listStoreProducts,
  resolveProductLink,
  setPackSizeByHand,
  updateManualProduct,
  upsertProductLink,
  upsertReadProduct,
} from "@norish/db/repositories/store-products";
import { getStoreById } from "@norish/db/repositories/stores";
import { searchStore } from "@norish/queue/store-lookup/lookup";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  StoreProductChoiceSchema,
  StoreProductLinkLookupSchema,
  StoreProductManualCreateSchema,
  StoreProductManualUpdateSchema,
  StoreProductsListInputSchema,
  StoreShopSearchSchema,
} from "@norish/shared/contracts/zod";
import { resolveSearchAddress } from "@norish/shared/lib/search-address";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { storeEmitter } from "./emitter";
import { priceTheList } from "./pricing";
import { assertStoreAccess } from "./stores-helpers";

const listProducts = authedProcedure
  .input(StoreProductsListInputSchema)
  .query(async ({ ctx, input }) => {
    await assertStoreAccess(ctx, input.storeId);

    return listStoreProducts(input.storeId);
  });

/**
 * What one Store has learned one grocery name means. `groceryPrices` answers
 * only for the Store each grocery sits under, so a panel where the shopper has
 * selected another Store has nowhere else to read its link from. A single
 * indexed row: no shop is visited and no lookup is queued.
 */
const linkFor = authedProcedure
  .input(StoreProductLinkLookupSchema)
  .query(async ({ ctx, input }): Promise<ResolvedProductLink | null> => {
    await assertStoreAccess(ctx, input.storeId);

    return resolveProductLink(input.storeId, input.name);
  });

/**
 * What every Grocery on the household's list costs, as its Store last knew.
 * Read on the list, so staleness is noticed exactly where somebody is
 * shopping and nowhere else.
 */
const groceryPrices = authedProcedure.query(async ({ ctx }) => priceTheList(ctx));

const createProduct = authedProcedure
  .input(StoreProductManualCreateSchema)
  .mutation(async ({ ctx, input }) => {
    await assertStoreAccess(ctx, input.storeId);

    const product = await createManualProduct(input);

    log.info({ userId: ctx.user.id, storeId: input.storeId }, "By-hand store product created");
    storeEmitter.emitToHousehold(ctx.householdKey, "productUpdated", { product });

    return product;
  });

const updateProduct = authedProcedure
  .input(StoreProductManualUpdateSchema)
  .mutation(async ({ ctx, input }) => {
    const existing = await getStoreProductById(input.id);

    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    await assertStoreAccess(ctx, existing.storeId);

    const product = await updateManualProduct(input);

    if (!product) {
      // A product read from a page keeps what the page said; only a by-hand
      // price is a person's to change.
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Only a by-hand product can be edited",
      });
    }
    storeEmitter.emitToHousehold(ctx.householdKey, "productUpdated", { product });

    return product;
  });

/**
 * Search a Store's own shop for a term the user chose, and offer what it
 * answers. The visit is paced through the same chain the lookup queue uses,
 * so the picker cannot race the queue at the same shop.
 */
const searchShop = authedProcedure
  .input(StoreShopSearchSchema)
  .query(async ({ ctx, input }): Promise<{ candidates: StoreCandidate[]; answered: boolean }> => {
    await assertStoreAccess(ctx, input.storeId);
    const store = await getStoreById(input.storeId);

    if (!store?.searchAddress) return { candidates: [], answered: false };

    // The same paced visit the lookup queue makes, so the picker cannot race
    // the queue at the same shop. Whether the shop answered at all travels
    // with the answer: a shop that is down has not said it stocks nothing.
    const { candidates, answered } = await searchStore(store.searchAddress, input.term);

    log.info(
      { userId: ctx.user.id, storeId: input.storeId, count: candidates.length, answered },
      "Searched a shop for the picker"
    );

    return { candidates, answered };
  });

function hostOf(address: string | null | undefined): string | null {
  if (!address) return null;
  try {
    return new URL(resolveSearchAddress(address, "term")).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * A search result the picker offered is a page of the Store's own shop. The
 * server never saw the search that produced it, so the one thing it can hold
 * the page to is the shop: the host of the Store's Search Address or website.
 */
async function assertCandidateIsTheShops(storeId: string, pageUrl: string): Promise<void> {
  const store = await getStoreById(storeId);
  const shop = hostOf(store?.searchAddress) ?? hostOf(store?.website);
  const page = hostOf(pageUrl);

  if (!shop || !page || (page !== shop && !page.endsWith(`.${shop}`))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Not a page of this Store's shop" });
  }
}

/**
 * A by-hand price, written as the shopper's own: a new product for a name
 * nobody typed a price for before, and the same product corrected where the
 * shopper typed over one they made earlier. A correction is not a second
 * product, or the Store's shelf would fill with every price they ever typed.
 * A product read from a page is never edited this way — the field mints a
 * fresh id for a price typed over one of those, and the correction keeps the
 * Sale, the deal's words, the size and the pack of the product it corrects:
 * the shopper is correcting that product, not describing a new one.
 */
async function writeManualProduct(
  storeId: string,
  choice: Extract<StoreProductChoice, { kind: "manual" }>
) {
  const existing = choice.id ? await getStoreProductById(choice.id) : null;

  if (!existing) {
    return createManualProduct({
      id: choice.id,
      storeId,
      name: choice.name,
      price: choice.price,
      currency: choice.currency,
      size: choice.size ?? null,
      pack: choice.pack ?? null,
      regularPrice: choice.regularPrice ?? null,
      dealWords: choice.dealWords ?? null,
    });
  }
  if (existing.storeId !== storeId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Product not found in this store" });
  }
  const updated = await updateManualProduct({
    id: existing.id,
    name: choice.name,
    price: choice.price,
    currency: choice.currency,
    size: choice.size ?? null,
    pack: choice.pack,
    regularPrice: choice.regularPrice,
    dealWords: choice.dealWords,
  });

  if (!updated) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Only a by-hand product can be edited",
    });
  }

  return updated;
}

/**
 * What the picker decided a grocery name means. Nothing is written until the
 * grocery panel's own Save calls this: tapping around in a picker never
 * changes what the household sees. Last writer wins — the last human to
 * choose is right.
 */
const chooseProduct = authedProcedure
  .input(StoreProductChoiceSchema)
  .mutation(async ({ ctx, input }): Promise<ResolvedProductLink | null> => {
    await assertStoreAccess(ctx, input.storeId);

    let storeProductId: string | null = null;

    if (input.choice.kind === "product") {
      const product = await getStoreProductById(input.choice.storeProductId);

      if (!product || product.storeId !== input.storeId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found in this store" });
      }
      storeProductId = product.id;
    }

    if (input.choice.kind === "candidate") {
      const { candidate } = input.choice;

      // A candidate came from the Store's own shop, so its page is on that
      // shop's host. Anything else is not a product page Norish will read and
      // refresh on the household's behalf.
      await assertCandidateIsTheShops(input.storeId, candidate.url);
      const product = await upsertReadProduct({
        storeId: input.storeId,
        name: candidate.name,
        pageUrl: candidate.url,
        price: candidate.price,
        currency: candidate.currency,
        size: candidate.size ?? null,
        pack: candidate.pack ?? null,
        regularPrice: candidate.regularPrice ?? null,
        dealWords: candidate.dealWords ?? null,
      });

      storeProductId = product.id;
      storeEmitter.emitToHousehold(ctx.householdKey, "productUpdated", { product });
    }

    if (input.choice.kind === "manual") {
      const product = await writeManualProduct(input.storeId, input.choice);

      storeProductId = product.id;
      storeEmitter.emitToHousehold(ctx.householdKey, "productUpdated", { product });
    }

    // A Pack Size the shopper set is the last word for whichever product the
    // choice resolved to; cleared, the product reads its own size words again.
    if (storeProductId && input.pack !== undefined) {
      const product = await setPackSizeByHand(storeProductId, input.pack);

      if (product) storeEmitter.emitToHousehold(ctx.householdKey, "productUpdated", { product });
    }

    await upsertProductLink(input.storeId, input.name, storeProductId);
    const link = await resolveProductLink(input.storeId, input.name);

    if (link) storeEmitter.emitToHousehold(ctx.householdKey, "linkUpdated", { link });

    return link;
  });

export const storeProductProcedures = router({
  groceryPrices,
  linkFor,
  listProducts,
  createProduct,
  updateProduct,
  searchShop,
  chooseProduct,
});
