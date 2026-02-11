import type { GroceryDto, StoreDto, RecurringGroceryDto } from "@/types";
import type { GroceryGroup } from "@/lib/grocery-grouping";

/** Container ID for groceries without a store assignment */
export const UNSORTED_CONTAINER = "unsorted" as const;

/** Store ID or UNSORTED_CONTAINER */
export type ContainerId = string;

/** Container ID => grocery IDs mapping (visual order during drag) */
export type ItemsState = Record<ContainerId, string[]>;

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
  onReorderInStore: (updates: { id: string; sortOrder: number; storeId?: string | null }[]) => void;
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
  onReorderGroups: (updates: { id: string; sortOrder: number; storeId?: string | null }[]) => void;
}
