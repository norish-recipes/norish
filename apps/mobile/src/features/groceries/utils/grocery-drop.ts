import type { Drop } from "@/components/drag-list/resolve-drop";

import type {
  AisleResolver,
  ContainerId,
  DropPlan,
  RecipeGroceries,
} from "@norish/shared-react/groceries";
import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import {
  aisleContainerId,
  buildGroupItemsState,
  buildItemsState,
  findContainerForItem,
  groceriesByStore,
  moveKey,
  planListDrop,
  planRecipeReorder,
  UNSORTED_CONTAINER,
} from "@norish/shared-react/groceries";

import type { ListHeading, ListItem } from "./list-rows";

export type GroceryDrop = Drop<ListHeading, ListItem>;

/** The key the shared plan knows a row by: a grocery's id, or a group's key. */
const keyOf = (item: ListItem) => (item.type === "line" ? item.grocery.id : item.group.groupKey);

const isDone = (item: ListItem) =>
  item.type === "line" ? item.grocery.isDone : item.group.allDone;

/** The container a heading opens; null for one a drop means nothing under (the done fold, a recipe). */
function containerOf(heading: ListHeading): ContainerId | null {
  if (heading.type === "store") return heading.store?.id ?? UNSORTED_CONTAINER;
  if (heading.type === "aisle") return aisleContainerId(heading.aisle.id);

  return null;
}

type StoreDropInput = {
  drop: GroceryDrop;
  /** The list as it is when the drop lands, which may differ from the one the row was lifted from. */
  groceries: readonly GroceryDto[];
  stores: StoreDto[];
  aisleFor: AisleResolver;
  /** The list grouped by food, per Store; null when every grocery is its own row. */
  groups: ReadonlyMap<string | null, GroceryGroup[]> | null;
};

/** A by-Store drop, placed after the nearest row above it still on the list now; null puts it back. */
export function planStoreDrop({
  drop,
  groceries,
  stores,
  aisleFor,
  groups,
}: StoreDropInput): DropPlan | null {
  const at = drop.rows.findIndex((row) => row.kind === "item" && row.value === drop.item);
  const above: string[] = [];
  let target: ContainerId | null = null;

  for (const row of drop.rows.slice(0, at).reverse()) {
    if (row.kind === "item") {
      above.push(keyOf(row.value));
      continue;
    }
    target = containerOf(row.value);
    break;
  }
  if (target === null || isDone(drop.item)) return null;

  const items = groups
    ? buildGroupItemsState(groups, stores)
    : buildItemsState(groceriesByStore(groceries, stores), stores, aisleFor);
  const key = keyOf(drop.item);
  const origin = findContainerForItem(key, items);

  if (origin === null || !(target in items)) return null;

  const into = (items[target] ?? []).filter((other) => other !== key);
  const after = above.find((other) => into.includes(other));
  const index = after === undefined ? 0 : into.indexOf(after) + 1;

  if (origin === target && items[origin]?.indexOf(key) === index) return null;

  const byId = new Map(groceries.map((grocery) => [grocery.id, grocery]));
  const byKey = new Map(
    [...(groups?.values() ?? [])].flat().map((group) => [group.groupKey, group])
  );

  return planListDrop({
    items: moveKey(items, key, origin, target, index),
    key,
    origin,
    target,
    stores,
    aisleFor,
    linesOf: (other) => {
      if (groups) return byKey.get(other)?.sources.map((source) => source.grocery) ?? [];
      const grocery = byId.get(other);

      return grocery ? [grocery] : [];
    },
  });
}

/**
 * A by-recipe drop: web reorders a recipe's open lines and nothing else, so a drop into another
 * recipe or among the done lines puts it back. Lines that arrived mid-drag keep their place after.
 */
export function planRecipeDrop(
  drop: GroceryDrop,
  recipes: readonly RecipeGroceries[]
): DropPlan | null {
  const { item, heading } = drop;

  if (item.type !== "line" || heading?.type !== "recipe") return null;

  const section = recipes.find(({ groceries }) =>
    groceries.some((grocery) => grocery.id === item.grocery.id)
  );

  if (!section || section.recipeId !== heading.recipeId) return null;

  const start = drop.rows.findIndex((row) => row.kind === "heading" && row.value === heading);
  const next = drop.rows.findIndex((row, index) => index > start && row.kind === "heading");
  const landed = drop.rows
    .slice(start + 1, next === -1 ? undefined : next)
    .flatMap((row) =>
      row.kind === "item" && row.value.type === "line" ? [row.value.grocery.id] : []
    );
  const open = section.groceries
    .filter((grocery) => !grocery.isDone)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((grocery) => grocery.id);
  const done = new Set(section.groceries.filter((grocery) => grocery.isDone).map((g) => g.id));

  if (landed.slice(0, landed.indexOf(item.grocery.id)).some((id) => done.has(id))) return null;

  const order = landed.filter((id) => open.includes(id));
  const ids = [...order, ...open.filter((id) => !order.includes(id))];

  if (ids.every((id, index) => open[index] === id)) return null;

  return { updates: planRecipeReorder(ids), filings: [] };
}
