import type { ResolvedProductLink } from "@norish/shared/contracts/dto/store-products";
import { findNewestGroceryNamed } from "@norish/db/repositories/groceries";

import type { AIE2EStack } from "./fixture";
import { queryTrpc } from "../harness/trpc";
import { createPlainStore, listStores } from "./grocery-aisles-support";

/** A Store pointing at the harness's own shop; the paste-and-derive flow has its own unit tests. */
export async function createShopStore(
  stack: AIE2EStack,
  name: string,
  shopUrl: string
): Promise<string> {
  const store = await createPlainStore(stack, name, {
    website: shopUrl,
    searchAddress: `${shopUrl}/search?q={query}`,
  });

  return store.id;
}

/** What the household's Stores have learned the Ingredient a grocery name reads as means. */
export async function readStoredLink(
  stack: AIE2EStack,
  name: string
): Promise<{ productName: string | null; price: number | null } | null> {
  for (const store of await listStores(stack)) {
    const link = await queryTrpc<ResolvedProductLink | null>(
      stack.baseURL,
      stack.ownerCookies,
      "stores.linkFor",
      { storeId: store.id, name }
    );

    if (link)
      return { productName: link.product?.name ?? null, price: link.product?.price ?? null };
  }

  return null;
}

/**
 * The stored requirement and purchase override, to wait for the server write. A repository read:
 * the list has no creation time, so the newest of same-named groceries (a rerun's) has no route.
 */
export async function readGroceryAmount(
  name: string
): Promise<{ amount: number | null; purchaseAmount: number | null } | null> {
  const grocery = await findNewestGroceryNamed(name);

  return grocery
    ? { amount: grocery.amount, purchaseAmount: grocery.purchaseAmount ?? null }
    : null;
}

/** Which Store the newest grocery of that name sits under. */
export async function readGroceryStore(stack: AIE2EStack, name: string): Promise<string | null> {
  const storeId = (await findNewestGroceryNamed(name))?.storeId;
  const stores = await listStores(stack);

  return stores.find((store) => store.id === storeId)?.name ?? null;
}
