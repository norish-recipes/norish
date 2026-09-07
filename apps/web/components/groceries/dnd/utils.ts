import type { UniqueIdentifier } from "@dnd-kit/core";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import { sortAisles } from "@norish/shared/lib/aisles";

import type { AisleResolver, ContainerId, GroupItemsState, ItemsState } from "./types";
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
 * The container a grocery sits in: its Store's aisle where the Store files
 * its name, the Store's unfiled area where it does not or the aisle is gone,
 * and `unsorted` without a Store. Nothing on the row says which (ADR-0031).
 */
export function getContainerIdForGrocery(
  grocery: Pick<GroceryDto, "storeId" | "name">,
  stores: StoreDto[] = [],
  aisleFor: AisleResolver = () => null
): ContainerId {
  if (!grocery.storeId) return UNSORTED_CONTAINER;
  const aisleId = aisleFor(grocery.storeId, grocery.name);
  const store = stores.find((candidate) => candidate.id === grocery.storeId);

  return aisleId !== null && store?.aisles.some((aisle) => aisle.id === aisleId)
    ? aisleContainerId(aisleId)
    : grocery.storeId;
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

/** Build initial items state from groceries (active items only, sorted by sortOrder) */
export function buildItemsState(
  groceries: GroceryDto[],
  stores: StoreDto[],
  aisleFor: AisleResolver = () => null
): ItemsState {
  const items = emptyContainers(stores);

  // Group active groceries by container
  const activeGroceries = groceries.filter((g) => !g.isDone);

  for (const grocery of activeGroceries) {
    const containerId = getContainerIdForGrocery(grocery, stores, aisleFor);

    (items[containerId] ??= []).push(grocery.id);
  }

  // Sort each container by sortOrder
  const order = new Map(groceries.map((g) => [g.id, g.sortOrder ?? 0]));

  for (const containerId of Object.keys(items)) {
    items[containerId].sort((aId, bId) => (order.get(aId) ?? 0) - (order.get(bId) ?? 0));
  }

  return items;
}

/** Build initial group items state (groups not all done), each group in the aisle it was grouped under */
export function buildGroupItemsState(
  groupedGroceries: Map<string | null, GroceryGroup[]>,
  stores: StoreDto[]
): GroupItemsState {
  const items = emptyContainers(stores);

  // Add group keys to appropriate containers
  for (const [storeId, groups] of groupedGroceries) {
    for (const group of groups) {
      // Only include groups that are not all done
      if (group.allDone) continue;
      const containerId = getContainerIdForGrocery(
        { storeId, name: null },
        stores,
        () => group.aisleId
      );

      (items[containerId] ??= []).push(group.groupKey);
    }
  }

  return items;
}

/** Find which container a group belongs to */
export function findContainerForGroup(
  groupKey: string,
  groupItems: GroupItemsState
): ContainerId | null {
  for (const [containerId, groupKeys] of Object.entries(groupItems)) {
    if (groupKeys.includes(groupKey)) {
      return containerId;
    }
  }

  return null;
}
