import type { SourceFood } from "./types";
import { parseRecords } from "../read/csv";
import { compositionValue, macros } from "../read/values";
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

    return code && name && numbers ? [{ code, name, ...numbers }] : [];
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
