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

/** What each Store remembers: Markt files melk in Zuivel and nothing else. */
const remembered: Record<string, string> = { [`${MARKT}|melk`]: ZUIVEL };
const aisleFor = (storeId: string | null, name: string | null) =>
  remembered[`${storeId}|${name}`] ?? null;

const row = (id: string) => [id];

describe("planDrop", () => {
  it("renumbers the Store as its block shows it and files the name in the aisle it was dropped in", () => {
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
      movedNames: ["kaas"],
      idsOf: row,
    });

    expect(plan.updates).toEqual([
      { id: "komkommer", sortOrder: 0 },
      { id: "sla", sortOrder: 1 },
      { id: "melk", sortOrder: 2 },
      { id: "kaas", sortOrder: 3 },
    ]);
    expect(plan.filings).toEqual([{ storeId: MARKT, name: "kaas", aisleId: ZUIVEL }]);
  });

  it("forgets a name dropped back into its Store's unfiled area, and keeps order within the aisle", () => {
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
      movedNames: ["melk"],
      idsOf: row,
    });

    expect(plan.filings).toEqual([{ storeId: MARKT, name: "melk", aisleId: null }]);
    expect(plan.updates.map((u) => u.id)).toEqual(["melk", "komkommer"]);
  });

  it("writes no filing where the Store already files the name there", () => {
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
      movedNames: ["melk"],
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
      movedNames: ["melk"],
      idsOf: row,
    });

    // The moved row carries its new Store; both Stores are renumbered.
    expect(plan.updates).toEqual([
      { id: "melk", sortOrder: 0, storeId: BAKKER },
      { id: "komkommer", sortOrder: 0 },
    ]);
    // Filed at the Bakker, which had never been told; Markt's memory is untouched.
    expect(plan.filings).toEqual([{ storeId: BAKKER, name: "melk", aisleId: BROOD }]);
  });

  it("only assigns when dropped into another Store's unfiled area, and teaches unsorted nothing", () => {
    const toBakker = planDrop({
      items: { [UNSORTED_CONTAINER]: [], [MARKT]: [], [BAKKER]: ["melk"] },
      originContainer: MARKT,
      targetContainer: BAKKER,
      stores: STORES,
      aisleFor,
      movedIds: ["melk"],
      movedNames: ["melk"],
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
      movedNames: ["melk"],
      idsOf: row,
    });

    expect(toUnsorted.updates).toEqual([{ id: "melk", sortOrder: 0, storeId: null }]);
    expect(toUnsorted.filings).toEqual([]);
  });

  it("files every distinct name of a dropped group, and numbers its sources as one", () => {
    const groups: Record<string, string[]> = {
      "g-kip": ["kip-1", "kip-2"],
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
      movedNames: ["Kip", "kip", "kip (diepvries)"],
      idsOf: (key) => groups[key] ?? [],
    });

    expect(plan.updates).toEqual([
      { id: "sla-1", sortOrder: 0 },
      { id: "kip-1", sortOrder: 1 },
      { id: "kip-2", sortOrder: 1 },
    ]);
    // "Kip" and "kip" are one name; "kip (diepvries)" is another.
    expect(plan.filings).toEqual([
      { storeId: MARKT, name: "Kip", aisleId: GROENTE },
      { storeId: MARKT, name: "kip (diepvries)", aisleId: GROENTE },
    ]);
  });
});
