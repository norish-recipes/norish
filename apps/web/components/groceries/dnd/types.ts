import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

/** Container ID for groceries without a store assignment */
export const UNSORTED_CONTAINER = "unsorted" as const;

/** Prefix of an aisle's container id: `aisle:<aisleId>`, inside its Store's block. */
export const AISLE_CONTAINER_PREFIX = "aisle:" as const;

/**
 * A droppable of the list: `unsorted`, a store id (the Store's own unfiled
 * area, at the top of its block) or `aisle:<aisleId>` (one aisle of a Store).
 */
export type ContainerId = string;

/** Container ID => grocery IDs mapping (visual order during drag) */
export type ItemsState = Record<ContainerId, string[]>;

/** The aisle a Store files a name under, or null where it has never been told (ADR-0031). */
export type AisleResolver = (storeId: string | null, name: string | null) => string | null;

/** File a name at a Store under an aisle, or under none (null), which forgets it. */
export type FileGroceryName = (storeId: string, name: string, aisleId: string | null) => void;

/** One row's or group's new place: a sort order per Store, and the Store where that changed. */
export interface ReorderUpdate {
  id: string;
  sortOrder: number;
  storeId?: string | null;
}

/** Context value provided by DndGroceryProvider */
export interface DndGroceryContextValue {
  activeId: string | null;
  activeGrocery: GroceryDto | null;
  overContainerId: ContainerId | null;
  items: ItemsState;
  getItemsForContainer: (containerId: ContainerId) => string[];
}

/** Props for the DndGroceryProvider component */
export interface DndGroceryProviderProps {
  children: React.ReactNode;
  groceries: GroceryDto[];
  stores: StoreDto[];
  recurringGroceries: RecurringGroceryDto[];
  onReorderInStore: (updates: ReorderUpdate[]) => void;
  /** Where each Store files each name; a drop into an aisle is a filing. */
  aisleFor: AisleResolver;
  onFileGroceryName: FileGroceryName;
  getRecipeNameForGrocery?: (grocery: GroceryDto) => string | null;
}

/** Container ID => group keys mapping (visual order during drag) */
export type GroupItemsState = Record<ContainerId, string[]>;

export type GroupDragHandle = (options: { dragHandle: React.ReactNode }) => React.ReactNode;

/** Context value provided by DndGroupedGroceryProvider */
export interface DndGroupedGroceryContextValue {
  activeGroupKey: string | null;
  activeGroup: GroceryGroup | null;
  overContainerId: ContainerId | null;
  groupItems: GroupItemsState;
  getGroupKeysForContainer: (containerId: ContainerId) => string[];
}

/** Props for the DndGroupedGroceryProvider component */
export interface DndGroupedGroceryProviderProps {
  children: React.ReactNode;
  stores: StoreDto[];
  groupedGroceries: Map<string | null, GroceryGroup[]>;
  onReorderGroups: (updates: ReorderUpdate[]) => void;
  /** Where each Store files each name; dropping a group into an aisle files every name in it. */
  aisleFor: AisleResolver;
  onFileGroceryName: FileGroceryName;
}
