import { describe, expect, it } from "vitest";

import { readCalnut } from "../src/datasets/calnut";
import { readCiqualTable, readCiqualWorkbook } from "../src/datasets/ciqual";
import { readCofid } from "../src/datasets/cofid";
import { readUsda } from "../src/datasets/usda";
import { parseDelimited } from "../src/read/csv";
import { compositionValue } from "../src/read/values";
import { CIQUAL_HEADER, usdaDownload, workbook } from "./fixtures";

describe("reading a composition table's values", () => {
  it.each([
    ["12,5", 12.5],
    ["0.4", 0.4],
    ["traces", 0],
    ["Tr", 0],
    ["< 0,5", 0.25],
    ["<2", 1],
    ["-", null],
    ["", null],
    ["N", null],
  ])("reads %j as %j", (raw, value) => {
    expect(compositionValue(raw)).toBe(value);
  });

  it("reads quoted cells with commas, quotes and line breaks inside", () => {
    expect(parseDelimited('"a, b","say ""hi""","x\ny"\nc,d,e\n')).toEqual([
      ["a, b", 'say "hi"', "x\ny"],
      ["c", "d", "e"],
    ]);
  });
});

describe("reading the datasets", () => {
  it("reads CIQUAL's workbook, skipping a food without all four numbers", async () => {
    const file = await workbook("food composition", [
      CIQUAL_HEADER,
      ["20034", "Onion, raw", "35", "1,1", "1,2", "6,8", "< 0,5"],
      ["11000", "Garlic, raw", "109", "5,31", "5,3", "18,6", "traces"],
      ["13050", "Apple, pulp, raw", "-", "0,3", "0,3", "11", "0,2"],
    ]);

    const { foods, names } = await readCiqualWorkbook(file);

    expect(foods).toEqual([
      { code: "20034", name: "Onion, raw", kcal: 35, protein: 1.1, carbs: 6.8, fat: 0.25 },
      { code: "11000", name: "Garlic, raw", kcal: 109, protein: 5.31, carbs: 18.6, fat: 0 },
    ]);
    expect(names.get("13050")).toBe("Apple, pulp, raw");
  });

  it("reads CIQUAL 2020's tab-separated table by the same columns", () => {
    const header = [
      "alim_code",
      "alim_nom_eng",
      "Energy, Regulation EU No 1169/2011 (kcal/100g)",
      "Protein (g/100g)",
      "Carbohydrate (g/100g)",
      "Fat (g/100g)",
    ];

    expect(
      readCiqualTable(`${header.join("\t")}\n20504\tLentil, dried\t300\t24\t50\t1,5\n`).foods
    ).toEqual([
      { code: "20504", name: "Lentil, dried", kcal: 300, protein: 24, carbs: 50, fat: 1.5 },
    ]);
  });

  it("reads CALNUT's middle bound", () => {
    const text = [
      "alim_code,FOOD_LABEL,HYPOTH,nrj_kcal,proteines_g,glucides_g,lipides_g",
      '13050,"Pomme, pulpe, crue",LB,"48,9","0,27","10,7","0,13"',
      '13050,"Pomme, pulpe, crue",MB,"49,5","0,27","10,8","0,15"',
      '13050,"Pomme, pulpe, crue",UB,"50,1","0,27","10,9","0,17"',
    ].join("\n");

    expect(readCalnut(text)).toEqual([
      {
        code: "13050",
        name: "Pomme, pulpe, crue",
        kcal: 49.5,
        protein: 0.27,
        carbs: 10.8,
        fat: 0.15,
      },
    ]);
  });

  it("reads CoFID's proximates past the two rows that name its columns", async () => {
    const file = await workbook("1.3 Proximates", [
      [
        "Food Code",
        "Food Name",
        "Protein (g)",
        "Fat (g)",
        "Carbohydrate (g)",
        "Energy (kcal) (kcal)",
      ],
      ["", "", "PROT", "FAT", "CHO", "KCALS"],
      ["", "", "Protein", "Fat", "Carbohydrate", "kcal"],
      ["13-336", "Sauerkraut", "1.1", "Tr", "1.0", "9"],
      ["17-999", "Something unmeasured", "N", "0.1", "1.0", "9"],
    ]);

    await expect(readCofid(file)).resolves.toEqual([
      { code: "13-336", name: "Sauerkraut", kcal: 9, protein: 1.1, carbs: 1, fat: 0 },
    ]);
  });

  it("reads USDA's energy, else Atwater's, and carbohydrate by difference, else by summation", async () => {
    const file = await usdaDownload("sr-legacy", [
      {
        fdcId: "170000",
        ndb: "11282",
        name: "Onions, raw",
        nutrients: { "1008": "40", "1003": "1.1", "1004": "0.1", "1005": "9.34" },
      },
      {
        fdcId: "2000000",
        name: "Something measured in Atwater",
        nutrients: { "2048": "52", "2047": "50", "1003": "1", "1004": "1", "1050": "8" },
      },
      {
        fdcId: "2000001",
        name: "No energy at all",
        nutrients: { "1003": "1", "1004": "1", "1005": "8" },
      },
    ]);

    await expect(readUsda(file, "sr-legacy")).resolves.toMatchObject([
      { code: "170000", ndb: "11282", kcal: 40, carbs: 9.34 },
      { code: "2000000", ndb: null, kcal: 52, carbs: 8 },
    ]);
  });

  it("weighs a piece by a medium portion, else the first counted one, and never a cup", async () => {
    const nutrients = { "1008": "40", "1003": "1", "1004": "0.1", "1005": "9" };
    const file = await usdaDownload("sr-legacy", [
      {
        fdcId: "1",
        name: "Onions, raw",
        nutrients,
        portions: [
          { amount: "1", modifier: "cup, chopped", grams: "160" },
          { amount: "1", modifier: "large", grams: "150" },
          { amount: "1", modifier: 'medium (2-1/2" dia)', grams: "110" },
        ],
      },
      {
        fdcId: "2",
        name: "Garlic, raw",
        nutrients,
        portions: [
          { amount: "1", modifier: "cup", grams: "136" },
          { amount: "1", modifier: "tsp", grams: "2.8" },
          { amount: "3", modifier: "cloves", grams: "9" },
        ],
      },
      {
        fdcId: "3",
        name: "Wheat flour, white, all-purpose",
        nutrients,
        portions: [{ amount: "1", modifier: "cup", grams: "125" }],
      },
    ]);

    await expect(readUsda(file, "sr-legacy")).resolves.toMatchObject([
      { code: "1", pieceWeight: 110, density: 0.6667 },
      { code: "2", pieceWeight: 3, density: 0.5667 },
      { code: "3", pieceWeight: null, density: 0.5208 },
    ]);
  });

  it("reads a Foundation food's measure from its unit, and leaves its NDB number to SR Legacy", async () => {
    const file = await usdaDownload("foundation", [
      {
        fdcId: "1104647",
        ndb: "11215",
        name: "Garlic, raw",
        nutrients: { "2047": "143", "1003": "6.62", "1004": "0.38", "1005": "28.2" },
        portions: [
          { amount: "1", unitId: "1001", modifier: "", grams: "8.5" },
          { amount: "1", unitId: "1036", modifier: "", grams: "40" },
        ],
      },
    ]);

    await expect(readUsda(file, "foundation")).resolves.toMatchObject([
      { code: "1104647", ndb: null, kcal: 143, pieceWeight: 40, density: 0.5667 },
    ]);
  });
});
