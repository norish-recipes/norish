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

/** What a drag arranged, until the list it was dropped on comes back from the cache. */
export interface Arrangement<T> {
  items: ItemsState;
  /** Every row or group by key, since one dragged in comes from another Store's. */
  byKey: Map<string, T>;
}

/** A list's DnD context; it changes only while a drag is on. */
interface ListDndContextValue<T> {
  activeId: string | null;
  overContainerId: ContainerId | null;
  /** Null while no drag is on: each Store then reads its containers off its own rows. */
  arrangement: Arrangement<T> | null;
}

export type DndGroceryContextValue = ListDndContextValue<GroceryDto>;
export type DndGroupedGroceryContextValue = ListDndContextValue<GroceryGroup>;

/** Props for the DndGroceryProvider component */
export interface DndGroceryProviderProps {
  children: React.ReactNode;
  /** The list's groceries under each Store, null for those under none. */
  groceriesByStore: Map<string | null, GroceryDto[]>;
  stores: StoreDto[];
  recurringGroceries: RecurringGroceryDto[];
  onReorderInStore: (updates: ReorderUpdate[]) => void;
  /** Where each Store files each name; a drop into an aisle is a filing. */
  aisleFor: AisleResolver;
  onFileGroceryName: FileGroceryName;
  getRecipeNameForGrocery?: (grocery: GroceryDto) => string | null;
}

/** Draws one group's row around the handle that drags it. */
export type GroupRow = (
  group: GroceryGroup,
  options: { dragHandle: React.ReactNode; isFirst: boolean; isLast: boolean }
) => React.ReactNode;

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
