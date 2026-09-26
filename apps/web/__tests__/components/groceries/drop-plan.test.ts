/**
 * What a drop means: a per-Store renumbering, and what it teaches the Store.
 * The drag itself is dnd-kit's; this is the one place its outcome is decided.
 */
import { aisleContainerId, UNSORTED_CONTAINER } from "@/components/groceries/dnd";
import { planDrop } from "@/components/groceries/dnd/drop-plan";
import { describe, expect, it } from "vitest";

import type { StoreDto } from "@norish/shared/contracts";

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
