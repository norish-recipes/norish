import { describe, expect, it } from "vitest";

import { foodOf } from "@norish/shared-server/ingredients/nutrition/source-table";

import type { Sources } from "../src/sources";
import { buildSourceTable, SourceTableError } from "../src/build";

const TAXONOMY = `
en: onion, onions
ciqual_food_code:en: 20034

< en: onion
en: red onion

en: alcohol
ciqual_food_code:en: 1014

< en: alcohol
en: brandy

en: apple
ciqual_food_code:en: 13050

en: lentil
ciqual_food_code:en: 20504
`;

const food = (code: string, name: string, kcal: number) => ({
  code,
  name,
  kcal,
  fat: 0,
  carbs: 1,
  protein: 1,
});

function ciqual(foods: ReturnType<typeof food>[], names: Record<string, string> = {}) {
  return {
    foods,
    names: new Map([
      ...foods.map((row) => [row.code, row.name] as const),
      ...Object.entries(names),
    ]),
  };
}

function sources(overrides: Partial<Sources> = {}): Sources {
  return {
    taxonomy: TAXONOMY,
    ciqual: ciqual([
      food("20034", "Onion, raw", 35),
      food("1014", "Pure alcohol", 660),
      food("1023", "Brandy", 222),
    ]),
    ciqual2020: ciqual([food("20034", "Onion, raw", 34), food("20504", "Lentil, dried", 300)]),
    calnut: [food("13050", "Pomme, pulpe, crue", 49), food("20034", "Oignon, cru", 35)],
    usda: [
      { ...food("170000", "Onions, red, raw", 40), ndb: "11282", pieceWeight: 110, density: 0.67 },
    ],
    cofid: [],
    ...overrides,
  };
}

const EDITIONS = { ciqual: "2025-11-03" };
const LISTS = { fixes: { "en:brandy": "ciqual:1023" as const }, neverLend: ["en:alcohol"] };

describe("building the source table", () => {
  it("keeps CIQUAL 2025, 2020 only for codes 2025 gives no numbers, CALNUT only for codes neither does", () => {
    const table = buildSourceTable(sources(), LISTS, EDITIONS);
    const keys = table.foods.map((row) => `${row[0]}:${row[1]}`);

    expect(keys).toContain("ciqual:20034");
    expect(keys).toContain("ciqual-2020:20504");
    expect(keys).not.toContain("ciqual-2020:20034");
    expect(keys).toContain("calnut:13050");
    expect(keys).not.toContain("calnut:20034");
  });

  it("names a CALNUT food by CIQUAL's English name where one is known", () => {
    // 2025 lists the apple without its energy; CALNUT fills it in.
    const base = sources();
    const table = buildSourceTable(
      sources({ ciqual: ciqual(base.ciqual.foods, { "13050": "Apple, pulp, raw" }) }),
      LISTS,
      EDITIONS
    );
    const calnut = table.foods.map(foodOf).filter((row) => row.dataset === "calnut");

    expect(calnut).toMatchObject([{ code: "13050", name: "Apple, pulp, raw", kcal: 49 }]);
  });

  it("keeps no food under a code its dataset gives two foods", () => {
    const table = buildSourceTable(
      sources({
        cofid: [food("13-669", "Aubergine, roasted", 100), food("13-669", "Watercress, raw", 20)],
      }),
      LISTS,
      EDITIONS
    );

    expect(table.foods.filter((row) => row[0] === "cofid")).toEqual([]);
  });

  it("carries USDA's piece weight, density and NDB number", () => {
    const table = buildSourceTable(sources(), LISTS, EDITIONS);

    expect(table.foods.map(foodOf).find((row) => row.dataset === "usda")).toMatchObject({
      code: "170000",
      ndb: "11282",
      pieceWeight: 110,
      density: 0.67,
    });
  });

  it("matches by name only the entries no code or fix gives numbers", () => {
    const table = buildSourceTable(sources(), LISTS, EDITIONS);

    expect(table.names).toEqual({ "en:red-onion": "usda:170000" });
  });

  it("carries the fix list and the lenders that never lend", () => {
    const table = buildSourceTable(sources(), LISTS, EDITIONS);

    expect(table.fixes).toEqual({ "en:brandy": "ciqual:1023" });
    expect(table.neverLend).toEqual(["en:alcohol"]);
  });

  it("fails where a fix names a food no dataset has any more", () => {
    expect(() =>
      buildSourceTable(sources(), { ...LISTS, fixes: { "en:brandy": "ciqual:9999" } }, EDITIONS)
    ).toThrow(SourceTableError);
    expect(() =>
      buildSourceTable(sources(), { ...LISTS, fixes: { "en:whisky": "ciqual:1023" } }, EDITIONS)
    ).toThrow(/en:whisky/);
    expect(() =>
      buildSourceTable(sources(), { ...LISTS, neverLend: ["en:sauce"] }, EDITIONS)
    ).toThrow(/en:sauce/);
  });

  it("keeps its version when nothing changed, and changes it when anything did", () => {
    const first = buildSourceTable(sources(), LISTS, EDITIONS);

    expect(buildSourceTable(sources(), LISTS, EDITIONS).version).toBe(first.version);
    expect(
      buildSourceTable(sources({ cofid: [food("13-336", "Sauerkraut", 9)] }), LISTS, EDITIONS)
        .version
    ).not.toBe(first.version);
  });
});
