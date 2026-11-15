import type {
  AisleResolver,
  ContainerId,
  FileGroceryName,
  ItemsState,
  ReorderUpdate,
} from "@norish/shared-react/groceries";
import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

/** What a drag arranged, until the list it was dropped on comes back from the cache. */
interface Arrangement<T> {
  items: ItemsState;
  /** Every row or group by key, since one dragged in comes from another Store's. */
  byKey: ReadonlyMap<string, T>;
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
