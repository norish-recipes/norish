import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import { foodKey } from "@norish/shared/lib/spelling-keys";

import type {
  AisleResolver,
  ContainerId,
  FileGroceryName,
  ItemsState,
  ReorderUpdate,
} from "./drop-containers";
import {
  buildGroupItemsState,
  buildItemsState,
  findContainerForItem,
  openBySortOrder,
  placeOfContainer,
  storeContainers,
} from "./drop-containers";

/** A grocery as a drop files it: its name, and the Ingredient that is filed. */
interface FiledGrocery {
  name: string | null;
  ingredientId?: string | null;
}

/** What a drop teaches a Store about one grocery. */
interface DropFiling {
  storeId: string;
  grocery: FiledGrocery;
  aisleId: string | null;
}

export interface DropPlan {
  /** Every row whose place changed: a per-Store sort order, and the Store on the one that moved. */
  updates: ReorderUpdate[];
  /** The aisle (or none) the target Store files the moved food under, written after the reorder. */
  filings: DropFiling[];
}

interface DropInput {
  /** The containers as the drag left them: the visual order to commit. */
  items: ItemsState;
  originContainer: ContainerId;
  targetContainer: ContainerId;
  stores: StoreDto[];
  aisleFor: AisleResolver;
  /** The grocery ids the dragged key stands for: one row, or a group's sources. */
  movedIds: readonly string[];
  /** The groceries the dragged key carries; a group files every one of them. */
  movedGroceries: readonly FiledGrocery[];
  /** The grocery ids behind each key in `items`; a group's sources all take its position. */
  idsOf: (key: string) => readonly string[];
}

/** Renumbers the target Store (and the one left) in its block's order, then files the food where
 * a drop into an aisle teaches the Store something new (ADR-0031). Two writes, each idempotent. */
export function planDrop(input: DropInput): DropPlan {
  const { items, originContainer, targetContainer, stores, aisleFor, movedGroceries, idsOf } =
    input;
  const moved = new Set(input.movedIds);
  const origin = placeOfContainer(originContainer, stores);
  const target = placeOfContainer(targetContainer, stores);
  const changedStore = origin.storeId !== target.storeId;

  const updates = new Map<string, ReorderUpdate>();
  const renumber = (storeId: string | null) => {
    let position = 0;

    for (const containerId of storeContainers(storeId, stores)) {
      for (const key of items[containerId] ?? []) {
        for (const id of idsOf(key)) {
          const update: ReorderUpdate = { id, sortOrder: position };

          if (changedStore && moved.has(id)) update.storeId = target.storeId;
          updates.set(id, update);
        }
        position += 1;
      }
    }
  };

  renumber(target.storeId);
  if (changedStore) renumber(origin.storeId);

  const filings: DropFiling[] = [];

  if (target.storeId !== null && (!changedStore || target.aisleId !== null)) {
    const seen = new Set<string>();

    for (const grocery of movedGroceries) {
      // One filing per food; a line added offline has no Ingredient yet, so its name's food key
      // stands in ("onions, diced" is "onions").
      const key = grocery.ingredientId ?? `name:${foodKey(grocery.name)}`;

      if (!grocery.name?.trim() || seen.has(key)) continue;
      seen.add(key);
      if (grocery.ingredientId && aisleFor(target.storeId, grocery.ingredientId) === target.aisleId)
        continue;
      filings.push({ storeId: target.storeId, grocery, aisleId: target.aisleId });
    }
  }

  return { updates: [...updates.values()], filings };
}

/** `items` with `key` taken out of `from` and put into `to` at `index`, counted without it. */
export function moveKey(
  items: ItemsState,
  key: string,
  from: ContainerId,
  to: ContainerId,
  index: number
): ItemsState {
  const left = (items[from] ?? []).filter((other) => other !== key);
  const into = from === to ? left : (items[to] ?? []);

  return { ...items, [from]: left, [to]: [...into.slice(0, index), key, ...into.slice(index)] };
}

/** A by-Store list as a drop reads it: its containers, each key's row or group, and its lines. */
export interface KeyedList<V> {
  items: ItemsState;
  byKey: ReadonlyMap<string, V>;
  linesOf: (key: string) => readonly GroceryDto[];
}

/** The list one row per grocery, each keyed by its id. */
export function keyedLines(
  byStore: Map<string | null, GroceryDto[]>,
  stores: StoreDto[],
  aisleFor: AisleResolver
): KeyedList<GroceryDto> {
  const byKey = new Map([...byStore.values()].flat().map((grocery) => [grocery.id, grocery]));

  return {
    items: buildItemsState(byStore, stores, aisleFor),
    byKey,
    linesOf: (key) => {
      const grocery = byKey.get(key);

      return grocery ? [grocery] : [];
    },
  };
}

/** The list grouped by food, each group keyed by its group key. */
export function keyedGroups(
  groups: ReadonlyMap<string | null, GroceryGroup[]>,
  stores: StoreDto[]
): KeyedList<GroceryGroup> {
  const byKey = new Map([...groups.values()].flat().map((group) => [group.groupKey, group]));

  return {
    items: buildGroupItemsState(groups, stores),
    byKey,
    linesOf: (key) => byKey.get(key)?.sources.map((source) => source.grocery) ?? [],
  };
}

interface KeyedDropInput {
  /** The containers before the drop. */
  items: ItemsState;
  linesOf: (key: string) => readonly (FiledGrocery & { id: string })[];
  /** The dragged key: a row's id, or a group's key. */
  key: string;
  target: ContainerId;
  /** Where in `target` the key lands, counted without it. */
  index: number;
  stores: StoreDto[];
  aisleFor: AisleResolver;
}

/** `key` moved to `index` in `target`, planned; null when the key or target is not on the list. */
export function planKeyedDrop({
  items,
  linesOf,
  key,
  target,
  index,
  ...list
}: KeyedDropInput): DropPlan | null {
  const origin = findContainerForItem(key, items);

  if (origin === null || !(target in items)) return null;

  const lines = linesOf(key);

  if (lines.length === 0) return { updates: [], filings: [] };

  return planDrop({
    ...list,
    items: moveKey(items, key, origin, target, index),
    originContainer: origin,
    targetContainer: target,
    movedIds: lines.map((grocery) => grocery.id),
    movedGroceries: lines,
    idsOf: (other) => linesOf(other).map((grocery) => grocery.id),
  });
}

/** Sends a plan: the reorder first, then each filing. False when it holds nothing to write. */
export function writeDrop(
  { updates, filings }: DropPlan,
  onReorder: (updates: ReorderUpdate[]) => void,
  onFileGroceryName: FileGroceryName
): boolean {
  if (updates.length > 0) onReorder(updates);
  for (const filing of filings) onFileGroceryName(filing.storeId, filing.grocery, filing.aisleId);

  return updates.length > 0 || filings.length > 0;
}

/** A recipe's open lines in the order a drop left them, numbered from the top; no Store changes. */
export function planRecipeReorder(ids: readonly string[]): ReorderUpdate[] {
  return ids.map((id, sortOrder) => ({ id, sortOrder }));
}

/** A by-recipe drop reorders the recipe's open lines as `landed` (its ids as the drop left them)
 * holds them; null for a drop below a done line, or one that changes nothing. */
export function planRecipeDrop(
  lines: readonly GroceryDto[],
  landed: readonly string[],
  id: string
): DropPlan | null {
  const open = openBySortOrder(lines).map((grocery) => grocery.id);
  const done = new Set(lines.filter((grocery) => grocery.isDone).map((grocery) => grocery.id));

  if (landed.slice(0, landed.indexOf(id)).some((other) => done.has(other))) return null;

  const order = landed.filter((other) => open.includes(other));
  const ids = [...order, ...open.filter((other) => !order.includes(other))];

  if (ids.every((other, index) => open[index] === other)) return null;

  return { updates: planRecipeReorder(ids), filings: [] };
}

/** The list under each Store, Unsorted (null) first; a line whose Store is gone sits under Unsorted. */
export function groceriesByStore(
  groceries: readonly GroceryDto[],
  stores: readonly StoreDto[]
): Map<string | null, GroceryDto[]> {
  const byStore = new Map<string | null, GroceryDto[]>([[null, []]]);

  for (const store of stores) byStore.set(store.id, []);
  for (const grocery of groceries) {
    (byStore.get(grocery.storeId) ?? byStore.get(null))?.push(grocery);
  }

  return byStore;
}
