import type { UniqueIdentifier } from "@dnd-kit/core";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import { sortAisles } from "@norish/shared/lib/aisles";

import type { AisleResolver, ContainerId, ItemsState } from "./types";
import { AISLE_CONTAINER_PREFIX, UNSORTED_CONTAINER } from "./types";

/** The container of one aisle, inside its Store's block. */
export function aisleContainerId(aisleId: string): ContainerId {
  return `${AISLE_CONTAINER_PREFIX}${aisleId}`;
}

/** The aisle a container stands for, or null for a Store's own unfiled area and for `unsorted`. */
export function aisleOfContainer(containerId: ContainerId): string | null {
  return containerId.startsWith(AISLE_CONTAINER_PREFIX)
    ? containerId.slice(AISLE_CONTAINER_PREFIX.length)
    : null;
}

/** Where a container is: which Store (null for `unsorted`) and which of its aisles (null for the unfiled area). */
export function placeOfContainer(
  containerId: ContainerId,
  stores: StoreDto[]
): { storeId: string | null; aisleId: string | null } {
  const aisleId = aisleOfContainer(containerId);

  if (aisleId !== null) {
    const store = stores.find((candidate) => candidate.aisles.some((a) => a.id === aisleId));

    return { storeId: store?.id ?? null, aisleId };
  }

  return { storeId: containerIdToStoreId(containerId), aisleId: null };
}

/**
 * A Store's containers in the order its block shows them: the unfiled area
 * first, then every aisle in the Store's order. Sort order is one number per
 * Store, so a drop re-numbers exactly these, in exactly this order.
 */
export function storeContainers(storeId: string | null, stores: StoreDto[]): ContainerId[] {
  if (storeId === null) return [UNSORTED_CONTAINER];
  const store = stores.find((candidate) => candidate.id === storeId);

  return [storeId, ...sortAisles(store?.aisles ?? []).map((aisle) => aisleContainerId(aisle.id))];
}

/**
 * The container for a place: `unsorted` without a Store, the Store's aisle
 * where it still has that aisle, and the Store's unfiled area where the aisle
 * is null or gone.
 */
export function containerFor(
  storeId: string | null,
  aisleId: string | null,
  stores: StoreDto[]
): ContainerId {
  if (!storeId) return UNSORTED_CONTAINER;
  const store = stores.find((candidate) => candidate.id === storeId);

  return aisleId !== null && store?.aisles.some((aisle) => aisle.id === aisleId)
    ? aisleContainerId(aisleId)
    : storeId;
}

/** Converts a Store-level container ID back to storeId (UNSORTED_CONTAINER => null) */
export function containerIdToStoreId(containerId: ContainerId): string | null {
  return containerId === UNSORTED_CONTAINER ? null : containerId;
}

/** Check if an ID is a container (store, aisle or unsorted) vs a grocery item */
export function isContainerId(id: UniqueIdentifier, stores: StoreDto[]): boolean {
  if (id === UNSORTED_CONTAINER) return true;
  if (typeof id === "string" && aisleOfContainer(id) !== null) return true;

  return stores.some((s) => s.id === id);
}

/** Find which container an item belongs to */
export function findContainerForItem(
  itemId: UniqueIdentifier,
  items: ItemsState
): ContainerId | null {
  for (const [containerId, itemIds] of Object.entries(items)) {
    if (itemIds.includes(itemId as string)) {
      return containerId;
    }
  }

  return null;
}

/** Every container the list has: unsorted, each Store's unfiled area, and each aisle. */
function emptyContainers(stores: StoreDto[]): ItemsState {
  const items: ItemsState = { [UNSORTED_CONTAINER]: [] };

  for (const store of stores) {
    for (const containerId of storeContainers(store.id, stores)) items[containerId] = [];
  }

  return items;
}

/**
 * One Store's containers and its open groceries in each, by sort order: a grocery sits
 * where its Store files its Ingredient, which nothing on the row says (ADR-0031, ADR-0037).
 */
export function storeItems(
  storeId: string | null,
  groceries: readonly GroceryDto[],
  stores: StoreDto[],
  aisleFor: AisleResolver
): ItemsState {
  const items: ItemsState = Object.fromEntries(
    storeContainers(storeId, stores).map((containerId) => [containerId, []])
  );
  const open = groceries
    .filter((grocery) => !grocery.isDone)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const grocery of open) {
    const containerId = containerFor(storeId, aisleFor(storeId, grocery.ingredientId), stores);

    (items[containerId] ??= []).push(grocery.id);
  }

  return items;
}

/** Every container the list has, with each Store's open groceries in theirs. */
export function buildItemsState(
  groceriesByStore: Map<string | null, GroceryDto[]>,
  stores: StoreDto[],
  aisleFor: AisleResolver
): ItemsState {
  const items = emptyContainers(stores);

  for (const [storeId, groceries] of groceriesByStore) {
    Object.assign(items, storeItems(storeId, groceries, stores, aisleFor));
  }

  return items;
}

/** One Store's containers and the groups in each (not all done), each in the aisle it was grouped under. */
export function storeGroupItems(
  storeId: string | null,
  groups: readonly GroceryGroup[],
  stores: StoreDto[]
): ItemsState {
  const items: ItemsState = Object.fromEntries(
    storeContainers(storeId, stores).map((containerId) => [containerId, []])
  );

  for (const group of groups) {
    if (group.allDone) continue;
    (items[containerFor(storeId, group.aisleId, stores)] ??= []).push(group.groupKey);
  }

  return items;
}

/** Every container the list has, with each Store's open groups in theirs. */
export function buildGroupItemsState(
  groupedGroceries: Map<string | null, GroceryGroup[]>,
  stores: StoreDto[]
): ItemsState {
  const items = emptyContainers(stores);

  for (const [storeId, groups] of groupedGroceries) {
    Object.assign(items, storeGroupItems(storeId, groups, stores));
  }

  return items;
}
