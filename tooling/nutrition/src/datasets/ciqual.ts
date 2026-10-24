import type { SourceFood } from "./types";
import { parseRecords } from "../read/csv";
import { compositionValue, extrasOf, macros, vitaminA } from "../read/values";
import { readSheet } from "../read/xlsx";

/**
 * CIQUAL (ANSES): the English table, 2025 from the workbook ANSES publishes,
 * 2020 from the tab-separated copy Open Food Facts vendors. A row without
 * all four numbers is no food here; values carry decimal commas and the
 * markers "-", "traces" and "< x".
 */

/** A header as both editions spell it: the workbook breaks lines and drops slashes. */
function headerKey(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .trim()
    .toLowerCase();
}

const COLUMNS = {
  code: (key: string) => key === "alim_code",
  name: (key: string) => key === "alim_nom_eng",
  kcal: (key: string) => key.startsWith("energy, regulation eu no 1169") && key.includes("kcal"),
  protein: (key: string) => key.startsWith("protein (g"),
  carbs: (key: string) => key.startsWith("carbohydrate (g"),
  fat: (key: string) => key.startsWith("fat (g"),
};

type Column = keyof typeof COLUMNS;

/** The other nutrients, read where an edition has the column: CIQUAL measures no trans fat. */
const EXTRA_COLUMNS = {
  saturatedFat: (key: string) => key.startsWith("fa saturated (g"),
  monounsaturatedFat: (key: string) => key.startsWith("fa mono (g"),
  polyunsaturatedFat: (key: string) => key.startsWith("fa poly (g"),
  sugars: (key: string) => key.startsWith("sugars (g"),
  fiber: (key: string) => key.startsWith("fibres (g"),
  cholesterol: (key: string) => key.startsWith("cholesterol (mg"),
  sodium: (key: string) => key.startsWith("sodium (mg"),
  potassium: (key: string) => key.startsWith("potassium (mg"),
  calcium: (key: string) => key.startsWith("calcium (mg"),
  iron: (key: string) => key.startsWith("iron (mg"),
  vitaminC: (key: string) => key.startsWith("vitamin c (mg"),
  retinol: (key: string) => /^retinol \((µg|mcg)/.test(key),
  betaCarotene: (key: string) => /^beta-carotene \((µg|mcg)/.test(key),
};

type ExtraColumn = keyof typeof EXTRA_COLUMNS;

/** A CIQUAL edition: its foods with all four numbers, and every row's English name by code. */
export interface CiqualTable {
  foods: SourceFood[];
  names: Map<string, string>;
}

function foodsFrom(rows: ReadonlyArray<Record<string, string>>): CiqualTable {
  const first = rows[0];

  if (!first) throw new Error("The CIQUAL table is empty");

  const header = new Map(Object.keys(first).map((name) => [headerKey(name), name]));
  const column = Object.fromEntries(
    (Object.keys(COLUMNS) as Column[]).map((wanted) => {
      const found = [...header.keys()].find(COLUMNS[wanted]);

      if (!found) throw new Error(`The CIQUAL table has no ${wanted} column`);

      return [wanted, header.get(found)!];
    })
  ) as Record<Column, string>;
  const extra = Object.fromEntries(
    (Object.keys(EXTRA_COLUMNS) as ExtraColumn[]).flatMap((wanted) => {
      const found = [...header.keys()].find(EXTRA_COLUMNS[wanted]);

      return found ? [[wanted, header.get(found)!]] : [];
    })
  ) as Partial<Record<ExtraColumn, string>>;
  const value = (row: Record<string, string>, wanted: ExtraColumn) =>
    extra[wanted] === undefined ? null : compositionValue(row[extra[wanted]]);

  const names = new Map<string, string>();
  const foods = rows.flatMap((row) => {
    const code = row[column.code]?.trim();
    const name = row[column.name]?.trim();

    if (code && name) names.set(code, name);

    const numbers = macros({
      kcal: compositionValue(row[column.kcal]),
      fat: compositionValue(row[column.fat]),
      carbs: compositionValue(row[column.carbs]),
      protein: compositionValue(row[column.protein]),
    });

    const extras = extrasOf({
      saturatedFat: value(row, "saturatedFat"),
      monounsaturatedFat: value(row, "monounsaturatedFat"),
      polyunsaturatedFat: value(row, "polyunsaturatedFat"),
      sugars: value(row, "sugars"),
      fiber: value(row, "fiber"),
      cholesterol: value(row, "cholesterol"),
      sodium: value(row, "sodium"),
      potassium: value(row, "potassium"),
      calcium: value(row, "calcium"),
      iron: value(row, "iron"),
      vitaminC: value(row, "vitaminC"),
      vitaminA: vitaminA(value(row, "retinol"), value(row, "betaCarotene")),
    });

    return code && name && numbers ? [{ code, name, ...numbers, extras }] : [];
  });

  return { foods, names };
}

/** The 2025 English workbook. */
export async function readCiqualWorkbook(file: Uint8Array): Promise<CiqualTable> {
  const [header, ...rows] = await readSheet(file, "food composition");

  if (!header) throw new Error("The CIQUAL workbook is empty");

  return foodsFrom(
    rows.map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])))
  );
}

/** The 2020 tab-separated table. */
export function readCiqualTable(text: string): CiqualTable {
  return foodsFrom(parseRecords(text, "\t"));
}
