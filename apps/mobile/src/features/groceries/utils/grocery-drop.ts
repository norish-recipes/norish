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
  groceriesByStore,
  keyedGroups,
  keyedLines,
  planKeyedDrop,
  planRecipeDrop,
  UNSORTED_CONTAINER,
} from "@norish/shared-react/groceries";

import type { ListHeading, ListItem } from "./list-rows";

export type GroceryDrop = Drop<ListHeading, ListItem>;

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

/** A by-Store drop, after the nearest row above it still on the list; null puts it back. */
export function planStoreRowDrop({
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
      above.push(row.value.key);
      continue;
    }
    target = containerOf(row.value);
    break;
  }
  if (target === null || drop.item.done) return null;

  const list = groups
    ? keyedGroups(groups, stores)
    : keyedLines(groceriesByStore(groceries, stores), stores, aisleFor);
  const { key } = drop.item;
  const was = list.items[target] ?? [];
  const into = was.filter((other) => other !== key);
  const after = above.find((other) => into.includes(other));
  const index = after === undefined ? 0 : into.indexOf(after) + 1;

  if (was.indexOf(key) === index) return null;

  return planKeyedDrop({ ...list, key, target, index, stores, aisleFor });
}

/** A by-recipe drop: the lines under the recipe's heading as the drop left them. */
export function planRecipeRowDrop(
  drop: GroceryDrop,
  recipes: readonly RecipeGroceries[]
): DropPlan | null {
  const { item, heading } = drop;

  if (item.type !== "line" || heading?.type !== "recipe") return null;

  const section = recipes.find(({ groceries }) =>
    groceries.some((grocery) => grocery.id === item.key)
  );

  if (!section || section.recipeId !== heading.recipeId) return null;

  const start = drop.rows.findIndex((row) => row.kind === "heading" && row.value === heading);
  const next = drop.rows.findIndex((row, index) => index > start && row.kind === "heading");
  const landed = drop.rows
    .slice(start + 1, next === -1 ? undefined : next)
    .flatMap((row) => (row.kind === "item" ? [row.value.key] : []));

  return planRecipeDrop(section.groceries, landed, item.key);
}
