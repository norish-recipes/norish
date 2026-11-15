/**
 * A drag list's drop as the shared plan reads it: the rows say where the row landed, the list as
 * it is now says what that means.
 */
import { resolveDrop } from "@/components/drag-list/resolve-drop";
import { planRecipeDrop, planStoreDrop } from "@/features/groceries/utils/grocery-drop";
import { recipeListRows, storeListRows } from "@/features/groceries/utils/list-rows";
import { describe, expect, it } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import { groupGroceriesByRecipe } from "@norish/shared-react/groceries";
import { groupGroceriesByIngredient } from "@norish/shared/lib/grocery-grouping";

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
const line = (id: string, storeId: string | null, sortOrder: number, extra = {}) =>
  ({
    id,
    name: id,
    storeId,
    isDone: false,
    sortOrder,
    ingredientId: `i-${id}`,
    amount: null,
    unit: null,
    recipeIngredientId: null,
    ...extra,
  }) as unknown as GroceryDto;

const STORES = [store("markt", 0, ["dairy"]), store("bakker", 1)];
// Markt files cheese under Dairy; nothing else is filed.
const aisleFor = (storeId: string | null, ingredientId: string | null | undefined) =>
  storeId === "markt" && ingredientId === "i-cheese" ? "dairy" : null;
const LIST = [
  line("loose", null, 0),
  line("apples", "markt", 0),
  line("pears", "markt", 1),
  line("cheese", "markt", 2),
  line("bread", "bakker", 0),
  line("buns", "bakker", 1, { isDone: true }),
];

function storeDrop(
  key: string,
  toKey: string,
  {
    lifted = LIST,
    now = lifted,
    grouped = false,
  }: { lifted?: GroceryDto[]; now?: GroceryDto[]; grouped?: boolean } = {}
) {
  const groupsOf = (groceries: GroceryDto[]) =>
    grouped
      ? groupGroceriesByIngredient(
          groceries,
          () => null,
          undefined,
          (grocery) => aisleFor(grocery.storeId, grocery.ingredientId)
        )
      : null;
  const rows = storeListRows({
    stores: STORES,
    groceries: lifted,
    aisleFor,
    groups: groupsOf(lifted),
    doneOpen: new Set(["bakker"]),
    collapsed: new Set(),
  });
  const at = (k: string) => rows.findIndex((row) => row.key === k);
  const drop = resolveDrop(rows, at(key), at(toKey));

  return planStoreDrop({
    drop: drop!,
    groceries: now,
    stores: STORES,
    aisleFor,
    groups: groupsOf(now),
  });
}

describe("planStoreDrop", () => {
  it("renumbers a Store for a reorder within it and files nothing", () => {
    // Rows: store:markt, apples, pears, aisle dairy, cheese; pears moves above apples.
    expect(storeDrop("line:pears", "line:apples")).toEqual({
      updates: [
        { id: "pears", sortOrder: 0 },
        { id: "apples", sortOrder: 1 },
        { id: "cheese", sortOrder: 2 },
      ],
      filings: [],
    });
  });

  it("moves a line to another Store, and to Unsorted", () => {
    const toBakker = storeDrop("line:apples", "line:bread");

    expect(toBakker?.updates).toContainEqual({ id: "apples", sortOrder: 1, storeId: "bakker" });
    expect(toBakker?.filings).toEqual([]);

    const toUnsorted = storeDrop("line:pears", "line:loose");

    // Above loose, Unsorted's one line.
    expect(toUnsorted?.updates).toContainEqual({ id: "pears", sortOrder: 0, storeId: null });
  });

  it("files a line dropped under an Aisle heading there", () => {
    const plan = storeDrop("line:apples", "line:cheese");

    expect(plan?.filings).toEqual([
      { storeId: "markt", grocery: expect.objectContaining({ id: "apples" }), aisleId: "dairy" },
    ]);
  });

  it("puts back a drop above the first heading or among the done lines", () => {
    expect(storeDrop("line:apples", "store:unsorted")).toBeNull();
    expect(storeDrop("line:bread", "line:buns")).toBeNull();
  });

  it("places the row by id in the list as it is when it lands", () => {
    // While pears was held, another member added figs at the top of Markt and deleted apples.
    const now = [line("figs", "markt", -1), ...LIST.filter((grocery) => grocery.id !== "apples")];
    const plan = storeDrop("line:pears", "line:cheese", { now });

    // Pears landed under Dairy, after cheese; figs keeps its place and apples is gone.
    expect(plan?.updates).toEqual([
      { id: "figs", sortOrder: 0 },
      { id: "cheese", sortOrder: 1 },
      { id: "pears", sortOrder: 2 },
    ]);
  });

  it("puts back a row another member ticked or deleted while it was held", () => {
    const now = LIST.filter((grocery) => grocery.id !== "pears");

    expect(storeDrop("line:pears", "line:bread", { now })).toBeNull();
  });

  it("moves a group as one, and only the sources in its own Store", () => {
    const lifted = [
      ...LIST,
      line("milk", "markt", 3),
      { ...line("milk-2", "markt", 4), name: "milk" },
      { ...line("milk-3", "bakker", 2), name: "milk" },
    ];
    // A group's row is keyed by its Store, aisle, name and unit.
    const plan = storeDrop("group:markt||milk|count", "group:bakker||bread|count", {
      lifted,
      grouped: true,
    });

    expect(plan?.updates.filter((update) => update.storeId === "bakker")).toEqual([
      { id: "milk", sortOrder: 1, storeId: "bakker" },
      { id: "milk-2", sortOrder: 1, storeId: "bakker" },
    ]);
  });
});

describe("planRecipeDrop", () => {
  const fromSoup = (id: string) => ({ recipeIngredientId: `ri-${id}` });
  const recipeMap = Object.fromEntries(
    ["leek", "stock", "salt"].map((id) => [`ri-${id}`, { recipeId: "r1", recipeName: "Soup" }])
  ) as never;
  const soup = [
    line("leek", "markt", 0, fromSoup("leek")),
    line("stock", null, 1, fromSoup("stock")),
    line("salt", "markt", 2, { ...fromSoup("salt"), isDone: true }),
  ];
  const manual = line("tea", null, 0);

  function recipeDrop(key: string, toKey: string, groceries = [...soup, manual]) {
    const recipes = groupGroceriesByRecipe(groceries, recipeMap, "Added by hand");
    const rows = recipeListRows(recipes, STORES);
    const at = (k: string) => rows.findIndex((row) => row.key === k);

    return planRecipeDrop(resolveDrop(rows, at(key), at(toKey))!, recipes);
  }

  it("reorders a recipe's open lines and moves none to another Store", () => {
    expect(recipeDrop("line:stock", "line:leek")).toEqual({
      updates: [
        { id: "stock", sortOrder: 0 },
        { id: "leek", sortOrder: 1 },
      ],
      filings: [],
    });
  });

  it("puts back a drop into another recipe or among the done lines", () => {
    expect(recipeDrop("line:leek", "line:tea")).toBeNull();
    expect(recipeDrop("line:leek", "line:salt")).toBeNull();
  });
});
