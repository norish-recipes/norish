import { resolveDrop } from "@/components/drag-list/resolve-drop";
import {
  isGroupOpen,
  recipeListRows,
  storeListRows,
  toggledGroup,
} from "@/features/groceries/utils/list-rows";
import { describe, expect, it } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

const store = (id: string, sortOrder: number, aisles: string[] = []) =>
  ({
    id,
    name: id,
    sortOrder,
    color: "primary",
    aisles: aisles.map((aisle, index) => ({
      id: aisle,
      storeId: id,
      name: aisle,
      sortOrder: index,
    })),
  }) as unknown as StoreDto;
const line = (id: string, storeId: string | null, extra: Partial<GroceryDto> = {}) =>
  ({
    id,
    name: id,
    storeId,
    isDone: false,
    sortOrder: 0,
    ingredientId: `i-${id}`,
    ...extra,
  }) as unknown as GroceryDto;
const noAisle = () => null;
const base = {
  groups: null,
  doneOpen: new Set<string>(),
  collapsed: new Set<string>(),
  aisleFor: noAisle,
};
const keys = (rows: { key: string }[]) => rows.map((row) => row.key);

describe("storeListRows", () => {
  it("lists Unsorted first, only while it holds a grocery, then the Stores in their order", () => {
    const stores = [store("b", 1), store("a", 0)];

    expect(
      keys(storeListRows({ ...base, stores, groceries: [line("x", null), line("y", "b")] }))
    ).toEqual(["store:unsorted", "line:x", "store:a", "store:b", "line:y"]);
    expect(keys(storeListRows({ ...base, stores, groceries: [line("y", "b")] }))).toEqual([
      "store:a",
      "store:b",
      "line:y",
    ]);
  });

  it("puts a grocery whose Store is gone under Unsorted", () => {
    expect(keys(storeListRows({ ...base, stores: [], groceries: [line("x", "gone")] }))).toEqual([
      "store:unsorted",
      "line:x",
    ]);
  });

  it("shows unfiled rows with no heading, then every aisle in order, empty or not", () => {
    const stores = [store("s", 0, ["veg", "dairy"])];
    const rows = storeListRows({
      ...base,
      stores,
      groceries: [
        line("milk", "s", { sortOrder: 1 }),
        line("kale", "s", { sortOrder: 2 }),
        line("odd", "s", { sortOrder: 3 }),
      ],
      aisleFor: (_store, ingredientId) =>
        ingredientId === "i-milk" ? "dairy" : ingredientId === "i-kale" ? "veg" : null,
    });

    expect(keys(rows)).toEqual([
      "store:s",
      "line:odd",
      "aisle:s:veg",
      "line:kale",
      "aisle:s:dairy",
      "line:milk",
    ]);
  });

  it("folds the done rows into one row that opens on tap", () => {
    const stores = [store("s", 0)];
    const groceries = [line("a", "s"), line("b", "s", { isDone: true })];

    expect(keys(storeListRows({ ...base, stores, groceries }))).toEqual([
      "store:s",
      "line:a",
      "done:s",
    ]);
    expect(keys(storeListRows({ ...base, stores, groceries, doneOpen: new Set(["s"]) }))).toEqual([
      "store:s",
      "line:a",
      "done:s",
      "line:b",
    ]);
  });

  it("makes the done fold a heading, so a drop among done rows lands under it, not an aisle", () => {
    const rows = storeListRows({
      ...base,
      stores: [store("s", 0, ["veg"])],
      groceries: [
        line("a", "s"),
        line("b", "s", { isDone: true }),
        line("c", "s", { isDone: true }),
      ],
      aisleFor: (_store, ingredientId) => (ingredientId === "i-a" ? "veg" : null),
      doneOpen: new Set(["s"]),
    });
    const done = rows.find((row) => row.key === "done:s");

    expect(done?.kind).toBe("heading");

    const drop = resolveDrop(
      rows,
      rows.findIndex((row) => row.key === "line:c"),
      rows.findIndex((row) => row.key === "line:b")
    );

    expect(drop?.heading).toMatchObject({ type: "done" });
  });

  it("folds a collapsed section to its heading", () => {
    const rows = storeListRows({
      ...base,
      stores: [store("s", 0)],
      groceries: [line("a", "s")],
      collapsed: new Set(["s"]),
    });

    expect(keys(rows)).toEqual(["store:s"]);
    expect(rows[0]?.value.edge).toEqual({ top: true, bottom: true });
  });

  it("rounds the heading's top and the last row's bottom, and nothing between", () => {
    const rows = storeListRows({
      ...base,
      stores: [store("s", 0)],
      groceries: [line("a", "s"), line("b", "s")],
    });

    expect(rows.map((row) => row.value.edge)).toEqual([
      { top: true, bottom: false },
      { top: false, bottom: false },
      { top: false, bottom: true },
    ]);
  });

  it("shows a group as one row in its aisle, an all-done group in the done tail", () => {
    const group = (key: string, aisleId: string | null, allDone: boolean) =>
      ({
        groupKey: key,
        aisleId,
        allDone,
        storeId: "s",
        sources: [{ grocery: line(key, "s"), recipeName: null }],
      }) as unknown as GroceryGroup;
    const stores = [store("s", 0, ["veg"])];
    const rows = storeListRows({
      ...base,
      stores,
      groceries: [line("a", "s")],
      groups: new Map([["s", [group("g1", "veg", false), group("g2", null, true)]]]),
    });

    expect(keys(rows)).toEqual(["store:s", "aisle:s:veg", "group:g1", "done:s"]);
  });
});

describe("recipeListRows", () => {
  it("lists a recipe's lines under its heading, the open ones before the done", () => {
    const rows = recipeListRows(
      [
        {
          recipeId: "r",
          recipeName: "Tacos",
          groceries: [line("done", "s", { isDone: true }), line("open", "s")],
        },
      ],
      [store("s", 0)]
    );

    expect(keys(rows)).toEqual(["recipe:r", "line:open", "line:done"]);
    expect(rows[1]).toMatchObject({ value: { type: "line", store: { id: "s" } } });
  });
});

describe("toggledGroup", () => {
  const groupOf = (...ids: string[]) =>
    ({
      sources: ids.map((id) => ({ grocery: line(id, null), recipeName: null })),
    }) as unknown as GroceryGroup;

  it("folds a group out and back in by its lines", () => {
    const milk = groupOf("a", "b");
    const open = toggledGroup(new Set(), milk, [line("a", null), line("b", null)]);

    expect(isGroupOpen(open, milk)).toBe(true);
    expect(isGroupOpen(toggledGroup(open, milk, [line("a", null), line("b", null)]), milk)).toBe(
      false
    );
  });

  it("forgets the lines of groups no longer on the list", () => {
    const open = toggledGroup(new Set(["gone"]), groupOf("a"), [line("a", null)]);

    expect([...open]).toEqual(["a"]);
  });
});
