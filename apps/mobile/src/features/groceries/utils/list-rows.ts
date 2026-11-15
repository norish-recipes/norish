import type { DragRow } from "@/components/drag-list/resolve-drop";

import type { PricedLine, RecipeGroceries } from "@norish/shared-react/groceries";
import type { AisleDto, GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import {
  groceriesByStore,
  lineOf,
  lineOfGroup,
  openBySortOrder,
  placeInAisles,
} from "@norish/shared-react/groceries";
import { bySortOrder } from "@norish/shared/lib/grocery-grouping";

import type { Edge } from "../components/card-edges";
import { edgeAt } from "../components/card-edges";

export type Heading =
  | {
      type: "store";
      /** Null for Unsorted, the groceries assigned to no Store. */
      store: StoreDto | null;
      /** What the section prices, one per row it shows: a grocery's own, or a group's. */
      lines: PricedLine[];
      open: number;
      done: number;
      collapsed: boolean;
      /** The ids a section's actions clear. */
      ids: string[];
    }
  | { type: "aisle"; aisle: AisleDto; count: number }
  /** The folded tail of a section: how many are done, and whether they are showing below. */
  | { type: "done"; sectionKey: string; count: number; open: boolean }
  | { type: "recipe"; recipeId: string | null; name: string; open: number; ids: string[] };

/** A grocery's row or a group's; `key` is what a drop plan knows it by. */
export type Item = { store: StoreDto | null; key: string; done: boolean } & (
  { type: "line"; grocery: GroceryDto } | { type: "group"; group: GroceryGroup }
);

/** A row's value with its corners; held in the value, so a drag list's renderers see them. */
export type ListHeading = Heading & { edge: Edge };
export type ListItem = Item & { edge: Edge };

export type ListRow = DragRow<ListHeading, ListItem>;

export const UNSORTED_KEY = "unsorted";

export const sectionKeyOf = (storeId: string | null) => storeId ?? UNSORTED_KEY;

const lineRow = (grocery: GroceryDto, store: StoreDto | null): DragRow<Heading, Item> => ({
  kind: "item",
  key: `line:${grocery.id}`,
  value: { type: "line", grocery, store, key: grocery.id, done: grocery.isDone },
});
const groupRow = (group: GroceryGroup, store: StoreDto | null): DragRow<Heading, Item> => ({
  kind: "item",
  key: `group:${group.groupKey}`,
  value: { type: "group", group, store, key: group.groupKey, done: group.allDone },
});

/** A section's rows with the card's corners set: the first rounds the top, the last the bottom. */
function sealed(rows: DragRow<Heading, Item>[]): ListRow[] {
  return rows.map((row, index): ListRow => {
    const edge = edgeAt(index, rows.length);

    if (row.kind === "heading") return { ...row, value: { ...row.value, edge } };

    return { ...row, value: { ...row.value, edge } };
  });
}

type StoreListInput = {
  stores: readonly StoreDto[];
  groceries: readonly GroceryDto[];
  /** Where each Store files each Ingredient (ADR-0031). */
  aisleFor: (storeId: string | null, ingredientId: string | null | undefined) => string | null;
  /** The list grouped by food, per Store; null shows one row per grocery. */
  groups: ReadonlyMap<string | null, GroceryGroup[]> | null;
  /** Sections whose done tail is showing. */
  doneOpen: ReadonlySet<string>;
  /** Sections folded to their heading. */
  collapsed: ReadonlySet<string>;
};

/**
 * The list by Store as flat rows, Unsorted first and only while it holds a grocery, then each
 * Store in its order. Under a heading: the unfiled rows with no heading, then every aisle in
 * the Store's order, then the done tail.
 */
export function storeListRows({
  stores,
  groceries,
  aisleFor,
  groups,
  doneOpen,
  collapsed,
}: StoreListInput): ListRow[] {
  const byStore = groceriesByStore(groceries, stores);
  const sections: (StoreDto | null)[] = [
    ...(byStore.get(null)?.length ? [null] : []),
    ...[...stores].sort((a, b) => a.sortOrder - b.sortOrder),
  ];

  return sections.flatMap((store) => {
    const storeId = store?.id ?? null;
    const key = sectionKeyOf(storeId);
    const own = byStore.get(storeId) ?? [];
    const storeGroups = groups?.get(storeId) ?? [];
    const isCollapsed = collapsed.has(key);
    const heading: DragRow<Heading, Item> = {
      kind: "heading",
      key: `store:${key}`,
      value: {
        type: "store",
        store,
        lines: groups ? storeGroups.map(lineOfGroup) : own.map(lineOf),
        open: own.filter((grocery) => !grocery.isDone).length,
        done: own.filter((grocery) => grocery.isDone).length,
        collapsed: isCollapsed,
        ids: own.map((grocery) => grocery.id),
      },
    };

    if (isCollapsed) return sealed([heading]);

    const item = (grocery: GroceryDto) => lineRow(grocery, store);
    const groupItem = (group: GroceryGroup) => groupRow(group, store);
    const body: DragRow<Heading, Item>[] = [];
    const doneRows: DragRow<Heading, Item>[] = [];

    if (groups) {
      const open = storeGroups.filter((group) => !group.allDone);
      const { unfiled, blocks } = placeInAisles(store, open, (group) => group.aisleId);

      body.push(...unfiled.map(groupItem));
      for (const { aisle, rows } of blocks) {
        body.push(
          {
            kind: "heading",
            key: `aisle:${key}:${aisle.id}`,
            value: { type: "aisle", aisle, count: rows.length },
          },
          ...rows.map(groupItem)
        );
      }
      doneRows.push(...storeGroups.filter((group) => group.allDone).map(groupItem));
    } else {
      const open = openBySortOrder(own);
      const { unfiled, blocks } = placeInAisles(store, open, (grocery) =>
        aisleFor(storeId, grocery.ingredientId)
      );

      body.push(...unfiled.map(item));
      for (const { aisle, rows } of blocks) {
        body.push(
          {
            kind: "heading",
            key: `aisle:${key}:${aisle.id}`,
            value: { type: "aisle", aisle, count: rows.length },
          },
          ...rows.map(item)
        );
      }
      doneRows.push(
        ...own
          .filter((grocery) => grocery.isDone)
          .sort(bySortOrder)
          .map(item)
      );
    }

    if (doneRows.length > 0) {
      const open = doneOpen.has(key);

      body.push(
        {
          kind: "heading",
          key: `done:${key}`,
          value: { type: "done", sectionKey: key, count: doneRows.length, open },
        },
        ...(open ? doneRows : [])
      );
    }

    return sealed([heading, ...body]);
  });
}

/** The list by recipe as flat rows: the lines no recipe added first, then each recipe by name. */
export function recipeListRows(
  recipes: readonly RecipeGroceries[],
  stores: readonly StoreDto[]
): ListRow[] {
  const storeById = new Map(stores.map((store) => [store.id, store]));

  return recipes.flatMap(({ recipeId, recipeName, groceries }) => {
    const open = openBySortOrder(groceries);
    const done = groceries.filter((grocery) => grocery.isDone).sort(bySortOrder);
    const line = (grocery: GroceryDto) =>
      lineRow(grocery, storeById.get(grocery.storeId ?? "") ?? null);

    return sealed([
      {
        kind: "heading",
        key: `recipe:${recipeId ?? "manual"}`,
        value: {
          type: "recipe",
          recipeId,
          name: recipeName,
          open: open.length,
          ids: groceries.map((grocery) => grocery.id),
        },
      },
      ...open.map(line),
      ...done.map(line),
    ]);
  });
}

/** A group is folded out while one of its lines is in `open`, so a drop that re-keys it keeps it. */
export const isGroupOpen = (open: ReadonlySet<string>, group: GroceryGroup) =>
  group.sources.some(({ grocery }) => open.has(grocery.id));

/** Folds `group` in or out of `open`, which keeps only lines still on the list. */
export function toggledGroup(
  open: ReadonlySet<string>,
  group: GroceryGroup,
  groceries: readonly GroceryDto[]
): Set<string> {
  const wasOpen = isGroupOpen(open, group);
  const next = new Set(groceries.flatMap(({ id }) => (open.has(id) ? [id] : [])));

  for (const { grocery } of group.sources) {
    if (wasOpen) next.delete(grocery.id);
    else next.add(grocery.id);
  }

  return next;
}
