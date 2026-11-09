/**
 * Where a Store's rows sit: its own unfiled area first, then each aisle in
 * the Store's order, with what is done left out.
 */
import { describe, expect, it } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

import { aisleContainerId, storeGroupItems, storeItems } from "./utils";

const MARKT = "store-markt";
const ZUIVEL = "aisle-zuivel";
const GROENTE = "aisle-groente";

const STORES = [
  {
    id: MARKT,
    aisles: [
      { id: ZUIVEL, storeId: MARKT, name: "Zuivel", sortOrder: 1, version: 1 },
      { id: GROENTE, storeId: MARKT, name: "Groente", sortOrder: 0, version: 1 },
    ],
  },
] as unknown as StoreDto[];

const group = (groupKey: string, aisleId: string | null, allDone = false) =>
  ({ groupKey, aisleId, allDone }) as GroceryGroup;

const grocery = (id: string, sortOrder: number, isDone = false) =>
  ({ id, ingredientId: `i-${id}`, sortOrder, isDone }) as GroceryDto;

describe("storeGroupItems", () => {
  it("puts each open group in its aisle, aisles in the Store's order, and leaves done ones out", () => {
    const groups = [
      group("melk", ZUIVEL),
      group("brood", null),
      group("sla", GROENTE),
      group("kaas", ZUIVEL, true),
      // An aisle the Store no longer has: the group is unfiled.
      group("ui", "aisle-gone"),
    ];

    expect(storeGroupItems(MARKT, groups, STORES)).toEqual({
      [MARKT]: ["brood", "ui"],
      [aisleContainerId(GROENTE)]: ["sla"],
      [aisleContainerId(ZUIVEL)]: ["melk"],
    });
    expect(Object.keys(storeGroupItems(MARKT, groups, STORES))).toEqual([
      MARKT,
      aisleContainerId(GROENTE),
      aisleContainerId(ZUIVEL),
    ]);
  });

  it("keeps the groups under no Store in `unsorted`, whatever aisle they name", () => {
    expect(storeGroupItems(null, [group("melk", ZUIVEL)], STORES)).toEqual({
      unsorted: ["melk"],
    });
  });
});

describe("storeItems", () => {
  it("files each open grocery where its Store files its food, by sort order", () => {
    const filed: Record<string, string> = { "i-melk": ZUIVEL, "i-kaas": ZUIVEL };
    const aisleFor = (_storeId: string | null, ingredientId: string | null | undefined) =>
      (ingredientId && filed[ingredientId]) || null;

    expect(
      storeItems(
        MARKT,
        [grocery("kaas", 2), grocery("melk", 1), grocery("brood", 0), grocery("yoghurt", 3, true)],
        STORES,
        aisleFor
      )
    ).toEqual({
      [MARKT]: ["brood"],
      [aisleContainerId(GROENTE)]: [],
      [aisleContainerId(ZUIVEL)]: ["melk", "kaas"],
    });
  });
});
