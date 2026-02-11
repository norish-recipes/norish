import type { GroceryDto, StoreDto } from "@/types";
import type { GroceryGroup } from "@/lib/grocery-grouping";
import type { UniqueIdentifier } from "@dnd-kit/core";
import type { ContainerId, ItemsState, GroupItemsState } from "./types";

import { UNSORTED_CONTAINER } from "./types";

/** Maps grocery.storeId to container ID (null => UNSORTED_CONTAINER) */
export function getContainerIdForGrocery(grocery: GroceryDto): ContainerId {
  return grocery.storeId ?? UNSORTED_CONTAINER;
}

/** Converts container ID back to storeId (UNSORTED_CONTAINER => null) */
export function containerIdToStoreId(containerId: ContainerId): string | null {
  return containerId === UNSORTED_CONTAINER ? null : containerId;
}

/** Check if an ID is a container (store or unsorted) vs a grocery item */
export function isContainerId(id: UniqueIdentifier, stores: StoreDto[]): boolean {
  if (id === UNSORTED_CONTAINER) return true;

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

/** Build initial items state from groceries (active items only, sorted by sortOrder) */
export function buildItemsState(groceries: GroceryDto[], stores: StoreDto[]): ItemsState {
  const items: ItemsState = {
    [UNSORTED_CONTAINER]: [],
  };

  // Initialize all store containers
  for (const store of stores) {
    items[store.id] = [];
  }

  // Group active groceries by container
  const activeGroceries = groceries.filter((g) => !g.isDone);

  for (const grocery of activeGroceries) {
    const containerId = getContainerIdForGrocery(grocery);

    if (!items[containerId]) {
      items[containerId] = [];
    }
    items[containerId].push(grocery.id);
  }

  // Sort each container by sortOrder
  for (const containerId of Object.keys(items)) {
    items[containerId].sort((aId, bId) => {
      const a = groceries.find((g) => g.id === aId);
      const b = groceries.find((g) => g.id === bId);

      return (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0);
    });
  }

  return items;
}

/** Build initial group items state (groups not all done) */
export function buildGroupItemsState(
  groupedGroceries: Map<string | null, GroceryGroup[]>,
  stores: StoreDto[]
): GroupItemsState {
  const items: GroupItemsState = {
    [UNSORTED_CONTAINER]: [],
  };

  // Initialize all store containers
  for (const store of stores) {
    items[store.id] = [];
  }

  // Add group keys to appropriate containers
  for (const [storeId, groups] of groupedGroceries) {
    const containerId = storeId ?? UNSORTED_CONTAINER;

    if (!items[containerId]) {
      items[containerId] = [];
    }

    // Only include groups that are not all done
    for (const group of groups) {
      if (!group.allDone) {
        items[containerId].push(group.groupKey);
      }
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
