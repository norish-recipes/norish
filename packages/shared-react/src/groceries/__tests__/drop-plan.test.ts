/**
 * What a drop means: a per-Store renumbering, and what it teaches the Store.
 * The drag itself is dnd-kit's; this is the one place its outcome is decided.
 */
import { describe, expect, it, vi } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";

import { aisleContainerId, UNSORTED_CONTAINER } from "../drop-containers";
import {
  groceriesByStore,
  keyedGroups,
  keyedLines,
  moveKey,
  planDrop,
  planKeyedDrop,
  planRecipeDrop,
  planRecipeReorder,
  writeDrop,
} from "../drop-plan";

const MARKT = "store-markt";
const BAKKER = "store-bakker";
const ZUIVEL = "aisle-zuivel";
const GROENTE = "aisle-groente";
const BROOD = "aisle-brood";

const STORES = [
  {
    id: MARKT,
    aisles: [
      { id: GROENTE, storeId: MARKT, name: "Groente", sortOrder: 0, version: 1 },
      { id: ZUIVEL, storeId: MARKT, name: "Zuivel", sortOrder: 1, version: 1 },
    ],
  },
  { id: BAKKER, aisles: [{ id: BROOD, storeId: BAKKER, name: "Brood", sortOrder: 0, version: 1 }] },
] as unknown as StoreDto[];

/** A grocery as a drop carries it: its name, and the Ingredient it resolved to. */
const grocery = (name: string, ingredientId: string | null = `i-${name.toLowerCase()}`) => ({
  name,
  ingredientId,
});

/** What each Store remembers: Markt files milk (i-melk) in Zuivel and nothing else. */
const remembered: Record<string, string> = { [`${MARKT}|i-melk`]: ZUIVEL };
const aisleFor = (storeId: string | null, ingredientId: string | null | undefined) =>
  remembered[`${storeId}|${ingredientId}`] ?? null;

const row = (id: string) => [id];

describe("planDrop", () => {
  it("renumbers the Store as its block shows it and files the Ingredient in the aisle it was dropped in", () => {
    // "kaas" was dragged from the unfiled area into Zuivel, under melk.
    const plan = planDrop({
      items: {
        [UNSORTED_CONTAINER]: [],
        [MARKT]: ["komkommer"],
        [aisleContainerId(GROENTE)]: ["sla"],
        [aisleContainerId(ZUIVEL)]: ["melk", "kaas"],
      },
      originContainer: MARKT,
      targetContainer: aisleContainerId(ZUIVEL),
      stores: STORES,
      aisleFor,
      movedIds: ["kaas"],
      movedGroceries: [grocery("kaas")],
      idsOf: row,
    });

    expect(plan.updates).toEqual([
      { id: "komkommer", sortOrder: 0 },
      { id: "sla", sortOrder: 1 },
      { id: "melk", sortOrder: 2 },
      { id: "kaas", sortOrder: 3 },
    ]);
    expect(plan.filings).toEqual([{ storeId: MARKT, grocery: grocery("kaas"), aisleId: ZUIVEL }]);
  });

  it("forgets an Ingredient dropped back into its Store's unfiled area, and keeps order within the aisle", () => {
    const plan = planDrop({
      items: {
        [UNSORTED_CONTAINER]: [],
        [MARKT]: ["melk", "komkommer"],
        [aisleContainerId(GROENTE)]: [],
        [aisleContainerId(ZUIVEL)]: [],
      },
      originContainer: aisleContainerId(ZUIVEL),
      targetContainer: MARKT,
      stores: STORES,
      aisleFor,
      movedIds: ["melk"],
      movedGroceries: [grocery("melk")],
      idsOf: row,
    });

    expect(plan.filings).toEqual([{ storeId: MARKT, grocery: grocery("melk"), aisleId: null }]);
    expect(plan.updates.map((u) => u.id)).toEqual(["melk", "komkommer"]);
  });

  it("writes no filing where the Store already files the Ingredient there", () => {
    // melk reordered within Zuivel: a reorder, and nothing to teach.
    const plan = planDrop({
      items: {
        [UNSORTED_CONTAINER]: [],
        [MARKT]: [],
        [aisleContainerId(GROENTE)]: [],
        [aisleContainerId(ZUIVEL)]: ["kaas", "melk"],
      },
      originContainer: aisleContainerId(ZUIVEL),
      targetContainer: aisleContainerId(ZUIVEL),
      stores: STORES,
      aisleFor,
      movedIds: ["melk"],
      movedGroceries: [grocery("melk")],
      idsOf: row,
    });

    expect(plan.filings).toEqual([]);
    expect(plan.updates).toEqual([
      { id: "kaas", sortOrder: 0 },
      { id: "melk", sortOrder: 1 },
    ]);
  });

  it("assigns the other Store and then files there, when dropped straight into its aisle", () => {
    const plan = planDrop({
      items: {
        [UNSORTED_CONTAINER]: [],
        [MARKT]: ["komkommer"],
        [aisleContainerId(GROENTE)]: [],
        [aisleContainerId(ZUIVEL)]: [],
        [BAKKER]: [],
        [aisleContainerId(BROOD)]: ["melk"],
      },
      originContainer: aisleContainerId(ZUIVEL),
      targetContainer: aisleContainerId(BROOD),
      stores: STORES,
      aisleFor,
      movedIds: ["melk"],
      movedGroceries: [grocery("melk")],
      idsOf: row,
    });

    // The moved row carries its new Store; both Stores are renumbered.
    expect(plan.updates).toEqual([
      { id: "melk", sortOrder: 0, storeId: BAKKER },
      { id: "komkommer", sortOrder: 0 },
    ]);
    // Filed at the Bakker, which had never been told; Markt's memory is untouched.
    expect(plan.filings).toEqual([{ storeId: BAKKER, grocery: grocery("melk"), aisleId: BROOD }]);
  });

  it("only assigns when dropped into another Store's unfiled area, and teaches unsorted nothing", () => {
    const toBakker = planDrop({
      items: { [UNSORTED_CONTAINER]: [], [MARKT]: [], [BAKKER]: ["melk"] },
      originContainer: MARKT,
      targetContainer: BAKKER,
      stores: STORES,
      aisleFor,
      movedIds: ["melk"],
      movedGroceries: [grocery("melk")],
      idsOf: row,
    });

    expect(toBakker.updates).toEqual([{ id: "melk", sortOrder: 0, storeId: BAKKER }]);
    expect(toBakker.filings).toEqual([]);

    const toUnsorted = planDrop({
      items: { [UNSORTED_CONTAINER]: ["melk"], [MARKT]: [] },
      originContainer: aisleContainerId(ZUIVEL),
      targetContainer: UNSORTED_CONTAINER,
      stores: STORES,
      aisleFor,
      movedIds: ["melk"],
      movedGroceries: [grocery("melk")],
      idsOf: row,
    });

    expect(toUnsorted.updates).toEqual([{ id: "melk", sortOrder: 0, storeId: null }]);
    expect(toUnsorted.filings).toEqual([]);
  });

  it("files every distinct Ingredient of a dropped group, and numbers its sources as one", () => {
    const groups: Record<string, string[]> = {
      "g-kip": ["kip-1", "kip-2", "kip-3"],
      "g-sla": ["sla-1"],
    };
    const plan = planDrop({
      items: {
        [UNSORTED_CONTAINER]: [],
        [MARKT]: ["g-sla"],
        [aisleContainerId(GROENTE)]: ["g-kip"],
        [aisleContainerId(ZUIVEL)]: [],
      },
      originContainer: MARKT,
      targetContainer: aisleContainerId(GROENTE),
      stores: STORES,
      aisleFor,
      movedIds: groups["g-kip"]!,
      movedGroceries: [grocery("Kip", "i-kip"), grocery("kip", "i-kip"), grocery("kippendij")],
      idsOf: (key) => groups[key] ?? [],
    });

    expect(plan.updates).toEqual([
      { id: "sla-1", sortOrder: 0 },
      { id: "kip-1", sortOrder: 1 },
      { id: "kip-2", sortOrder: 1 },
      { id: "kip-3", sortOrder: 1 },
    ]);
    // "Kip" and "kip" are one Ingredient; "kippendij" is another.
    expect(plan.filings).toEqual([
      { storeId: MARKT, grocery: grocery("Kip", "i-kip"), aisleId: GROENTE },
      { storeId: MARKT, grocery: grocery("kippendij"), aisleId: GROENTE },
    ]);
  });

  it("files two groceries of one Ingredient in a dropped group once, however they are spelled", () => {
    const plan = planDrop({
      items: {
        [UNSORTED_CONTAINER]: [],
        [MARKT]: [],
        [aisleContainerId(GROENTE)]: ["g-uien"],
        [aisleContainerId(ZUIVEL)]: [],
      },
      originContainer: MARKT,
      targetContainer: aisleContainerId(GROENTE),
      stores: STORES,
      aisleFor,
      movedIds: ["ui-1", "ui-2"],
      movedGroceries: [grocery("onions", "i-onion"), grocery("uien", "i-onion")],
      idsOf: () => ["ui-1", "ui-2"],
    });

    expect(plan.filings).toEqual([
      { storeId: MARKT, grocery: grocery("onions", "i-onion"), aisleId: GROENTE },
    ]);
  });

  it("files a grocery the server has not resolved yet by its name, since it has no Ingredient", () => {
    const plan = planDrop({
      items: {
        [UNSORTED_CONTAINER]: [],
        [MARKT]: [],
        [aisleContainerId(GROENTE)]: [],
        [aisleContainerId(ZUIVEL)]: ["melk"],
      },
      originContainer: MARKT,
      targetContainer: aisleContainerId(ZUIVEL),
      stores: STORES,
      aisleFor,
      movedIds: ["melk"],
      movedGroceries: [grocery("melk", null)],
      idsOf: row,
    });

    expect(plan.filings).toEqual([
      { storeId: MARKT, grocery: grocery("melk", null), aisleId: ZUIVEL },
    ]);
  });
});

describe("moveKey", () => {
  it("moves a key within its container as arrayMove does", () => {
    expect(moveKey({ a: ["x", "y", "z"] }, "x", "a", "a", 2)).toEqual({ a: ["y", "z", "x"] });
  });

  it("moves a key into another container at an index", () => {
    expect(moveKey({ a: ["x", "y"], b: ["z"] }, "x", "a", "b", 1)).toEqual({
      a: ["y"],
      b: ["z", "x"],
    });
  });
});

describe("planKeyedDrop", () => {
  const lines: Record<string, { id: string; name: string; ingredientId: string }[]> = {
    melk: [{ id: "melk", name: "melk", ingredientId: "i-melk" }],
    group: [
      { id: "kaas-1", name: "kaas", ingredientId: "i-kaas" },
      { id: "kaas-2", name: "kaas", ingredientId: "i-kaas" },
    ],
  };
  const linesOf = (key: string) => lines[key] ?? [];

  it("moves a group's every line to its place and files its food once", () => {
    const plan = planKeyedDrop({
      items: { [UNSORTED_CONTAINER]: ["group"], [BAKKER]: [], [aisleContainerId(BROOD)]: [] },
      key: "group",
      target: BAKKER,
      index: 0,
      stores: STORES,
      aisleFor,
      linesOf,
    });

    expect(plan?.updates).toEqual([
      { id: "kaas-1", sortOrder: 0, storeId: BAKKER },
      { id: "kaas-2", sortOrder: 0, storeId: BAKKER },
    ]);
    // Another Store's unfiled area teaches it nothing.
    expect(plan?.filings).toEqual([]);
  });

  it("puts the key at its index among the others", () => {
    const plan = planKeyedDrop({
      items: { [MARKT]: ["melk", "a", "b"] },
      key: "melk",
      target: MARKT,
      index: 2,
      stores: STORES,
      aisleFor,
      linesOf: (key) => (linesOf(key).length ? linesOf(key) : [{ id: key, name: key }]),
    });

    expect(plan?.updates.map((update) => update.id)).toEqual(["a", "b", "melk"]);
  });

  it("plans nothing for a key that stands for no grocery", () => {
    expect(
      planKeyedDrop({
        items: { [MARKT]: ["gone"] },
        key: "gone",
        target: MARKT,
        index: 0,
        stores: STORES,
        aisleFor,
        linesOf,
      })
    ).toEqual({ updates: [], filings: [] });
  });

  it("puts back a key or a target that is not on the list", () => {
    const drop = (key: string, target: string) =>
      planKeyedDrop({
        items: { [MARKT]: ["melk"] },
        key,
        target,
        index: 0,
        stores: STORES,
        aisleFor,
        linesOf,
      });

    expect(drop("kaas", MARKT)).toBeNull();
    expect(drop("melk", "nowhere")).toBeNull();
  });
});

describe("keyedLines and keyedGroups", () => {
  const line = (id: string, storeId: string | null, sortOrder: number) =>
    ({ id, name: id, storeId, sortOrder, isDone: false }) as unknown as GroceryDto;

  it("keys a row by its id and stands for that one line", () => {
    const melk = line("melk", MARKT, 0);
    const list = keyedLines(groceriesByStore([melk], STORES), STORES, aisleFor);

    expect(list.items[MARKT]).toEqual(["melk"]);
    expect(list.byKey.get("melk")).toBe(melk);
    expect(list.linesOf("melk")).toEqual([melk]);
    expect(list.linesOf("gone")).toEqual([]);
  });

  it("keys a group by its key and stands for its sources", () => {
    const kaas = [line("kaas-1", BAKKER, 0), line("kaas-2", BAKKER, 1)];
    const group = {
      groupKey: "kaas",
      aisleId: null,
      allDone: false,
      sources: kaas.map((grocery) => ({ grocery, recipeName: null })),
    };
    const list = keyedGroups(new Map([[BAKKER, [group as never]]]), STORES);

    expect(list.items[BAKKER]).toEqual(["kaas"]);
    expect(list.linesOf("kaas")).toEqual(kaas);
  });
});

describe("planRecipeDrop", () => {
  const line = (id: string, sortOrder: number, isDone = false) =>
    ({ id, sortOrder, isDone }) as unknown as GroceryDto;
  const LINES = [line("a", 0), line("b", 1), line("c", 2), line("done", 3, true)];

  it("reorders the open lines as the drop left them", () => {
    expect(planRecipeDrop(LINES, ["c", "a", "b", "done"], "c")?.updates).toEqual([
      { id: "c", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
  });

  it("keeps a line that arrived mid-drag after the ones the drop placed", () => {
    expect(planRecipeDrop([...LINES, line("new", 4)], ["b", "a", "c"], "b")?.updates).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
      { id: "new", sortOrder: 3 },
    ]);
  });

  it("puts back a drop below a done line, or one that changes nothing", () => {
    expect(planRecipeDrop(LINES, ["b", "c", "done", "a"], "a")).toBeNull();
    expect(planRecipeDrop(LINES, ["a", "b", "c", "done"], "b")).toBeNull();
  });
});

describe("writeDrop", () => {
  it("sends the reorder before the filings and says it wrote", () => {
    const calls: string[] = [];
    const wrote = writeDrop(
      {
        updates: [{ id: "melk", sortOrder: 0 }],
        filings: [{ storeId: MARKT, grocery: grocery("melk"), aisleId: ZUIVEL }],
      },
      () => calls.push("reorder"),
      () => calls.push("file")
    );

    expect(wrote).toBe(true);
    expect(calls).toEqual(["reorder", "file"]);
  });

  it("writes nothing for an empty plan", () => {
    const onReorder = vi.fn();

    expect(writeDrop({ updates: [], filings: [] }, onReorder, vi.fn())).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
  });
});

describe("planRecipeReorder", () => {
  it("numbers a recipe's lines from the top and moves none to another Store", () => {
    expect(planRecipeReorder(["b", "a"])).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });
});

describe("groceriesByStore", () => {
  it("puts a line under its Store, and one whose Store is gone under Unsorted", () => {
    const line = (id: string, storeId: string | null) => ({ id, storeId }) as GroceryDto;
    const byStore = groceriesByStore(
      [line("melk", MARKT), line("brood", "store-gone"), line("kaas", null)],
      STORES
    );

    expect([...byStore].map(([storeId, rows]) => [storeId, rows.map((r) => r.id)])).toEqual([
      [null, ["brood", "kaas"]],
      [MARKT, ["melk"]],
      [BAKKER, []],
    ]);
  });
});
