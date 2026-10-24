import { randomUUID } from "node:crypto";

import type { AisleLinkDto, StoreDto } from "@norish/shared/contracts/dto/stores";

import type { AIE2EStack } from "./fixture";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { expect } from "./fixture";

/**
 * A plain Store on the owner's list, with no shop behind it unless `website` says so,
 * made through the Store editor's procedure; a Store already of that name goes first.
 */
export async function createPlainStore(
  stack: AIE2EStack,
  name: string,
  columns: { website?: string; searchAddress?: string; aisles?: string[] } = {}
): Promise<StoreDto> {
  await deleteStoresNamed(stack, name);
  const id = await callTrpc<string>(stack.baseURL, stack.ownerCookies, "stores.create", {
    id: randomUUID(),
    name,
    website: columns.website,
    searchAddress: columns.searchAddress,
    aisles: columns.aisles?.map((aisle) => ({ id: randomUUID(), name: aisle })),
  });
  const [store] = (await listStores(stack)).filter((candidate) => candidate.id === id);

  if (!store) throw new Error(`The Store ${name} was not created`);

  return store;
}

/** The owner's household's Stores, with their aisles. */
export function listStores(stack: AIE2EStack): Promise<StoreDto[]> {
  return callTrpc<StoreDto[]>(stack.baseURL, stack.ownerCookies, "stores.list");
}

/** Every Store of that name on the owner's list. */
export async function storesNamed(stack: AIE2EStack, name: string): Promise<StoreDto[]> {
  return (await listStores(stack)).filter((store) => store.name === name);
}

/** Delete every Store of that name; its groceries stay, filed under no Store. */
export async function deleteStoresNamed(stack: AIE2EStack, name: string): Promise<void> {
  const stores = await storesNamed(stack, name);

  for (const store of stores) {
    await callTrpc(stack.baseURL, stack.ownerCookies, "stores.delete", {
      storeId: store.id,
      version: store.version,
      deleteGroceries: false,
      grocerySnapshot: [],
    });
  }
  // The delete answers before it lands.
  if (stores.length > 0) await expect.poll(() => storesNamed(stack, name)).toEqual([]);
}

/** The Ingredient a name reads as, without resolving or minting anything; null for none. */
export async function ingredientIdOf(stack: AIE2EStack, name: string): Promise<string | null> {
  const found = await queryTrpc<{ ingredientId: string } | null>(
    stack.baseURL,
    stack.ownerCookies,
    "ingredients.find",
    { name }
  );

  return found?.ingredientId ?? null;
}

/** The aisle a Store of that name files a grocery name's Ingredient under, or null. */
export async function readAisleFiling(
  stack: AIE2EStack,
  storeName: string,
  name: string
): Promise<string | null> {
  const [stores, ingredientId, links] = await Promise.all([
    storesNamed(stack, storeName),
    ingredientIdOf(stack, name),
    callTrpc<AisleLinkDto[]>(stack.baseURL, stack.ownerCookies, "stores.aisleLinks"),
  ]);
  const aisles = stores.flatMap((store) => store.aisles);
  const link = links.find(
    (candidate) =>
      candidate.ingredientId === ingredientId &&
      aisles.some((aisle) => aisle.id === candidate.aisleId)
  );

  return aisles.find((aisle) => aisle.id === link?.aisleId)?.name ?? null;
}

/** A Store's aisle names, in the Store's order. */
export async function readStoreAisles(stack: AIE2EStack, storeName: string): Promise<string[]> {
  return (await storesNamed(stack, storeName))
    .flatMap((store) => store.aisles)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((aisle) => aisle.name);
}
