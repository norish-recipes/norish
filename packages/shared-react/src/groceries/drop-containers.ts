import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import { sortAisles } from "@norish/shared/lib/aisles";

import { placeInAisles } from "./aisle-blocks";

/** Container ID for groceries without a store assignment */
export const UNSORTED_CONTAINER = "unsorted" as const;

/** Prefix of an aisle's container id: `aisle:<aisleId>`, inside its Store's block. */
const AISLE_CONTAINER_PREFIX = "aisle:" as const;

/**
 * A droppable of the list: `unsorted`, a store id (the Store's own unfiled
 * area, at the top of its block) or `aisle:<aisleId>` (one aisle of a Store).
 */
export type ContainerId = string;

/** Container ID => the keys in it, a row's id or a group's key, in the order shown. */
export type ItemsState = Record<ContainerId, string[]>;

/** The aisle a Store files an Ingredient under, or null where it has never been told (ADR-0031). */
export type AisleResolver = (
  storeId: string | null,
  ingredientId: string | null | undefined
) => string | null;

/** File a grocery's Ingredient at a Store under an aisle, or under none (null), which forgets it. */
export type FileGroceryName = (
  storeId: string,
  grocery: { name: string | null; ingredientId?: string | null },
  aisleId: string | null
) => void;

/** One row's or group's new place: a sort order per Store, and the Store where that changed. */
export interface ReorderUpdate {
  id: string;
  sortOrder: number;
  storeId?: string | null;
}

/** The container of one aisle, inside its Store's block. */
export function aisleContainerId(aisleId: string): ContainerId {
  return `${AISLE_CONTAINER_PREFIX}${aisleId}`;
}

/** The aisle a container stands for, or null for a Store's own unfiled area and for `unsorted`. */
function aisleOfContainer(containerId: ContainerId): string | null {
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

/** Converts a Store-level container ID back to storeId (UNSORTED_CONTAINER => null) */
function containerIdToStoreId(containerId: ContainerId): string | null {
  return containerId === UNSORTED_CONTAINER ? null : containerId;
}

/** Find which container an item belongs to */
export function findContainerForItem(itemId: string, items: ItemsState): ContainerId | null {
  for (const [containerId, itemIds] of Object.entries(items)) {
    if (itemIds.includes(itemId)) {
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

/** One Store's containers filled from its aisle blocks, a row's key in the container of its aisle. */
function fillContainers<T>(
  storeId: string | null,
  stores: StoreDto[],
  rows: readonly T[],
  aisleIdOf: (row: T) => string | null,
  keyOf: (row: T) => string
): ItemsState {
  const items: ItemsState = Object.fromEntries(
    storeContainers(storeId, stores).map((containerId) => [containerId, []])
  );
  const { unfiled, blocks } = placeInAisles(
    stores.find((candidate) => candidate.id === storeId),
    rows,
    aisleIdOf
  );

  (items[storeId ?? UNSORTED_CONTAINER] ??= []).push(...unfiled.map(keyOf));
  for (const { aisle, rows: filed } of blocks) {
    (items[aisleContainerId(aisle.id)] ??= []).push(...filed.map(keyOf));
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
  const open = groceries
    .filter((grocery) => !grocery.isDone)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return fillContainers(
    storeId,
    stores,
    open,
    (grocery) => aisleFor(storeId, grocery.ingredientId),
    (grocery) => grocery.id
  );
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
  return fillContainers(
    storeId,
    stores,
    groups.filter((group) => !group.allDone),
    (group) => group.aisleId,
    (group) => group.groupKey
  );
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
