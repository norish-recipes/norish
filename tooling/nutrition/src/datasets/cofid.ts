import type { SourceFood } from "./types";
import { compositionValue, extrasOf, macros, vitaminA } from "../read/values";
import { readSheet, sheetNames } from "../read/xlsx";

/**
 * CoFID 2021, McCance and Widdowson's (UK, OGL v3): the "1.3 Proximates"
 * sheet, with the minerals and vitamins of "1.4 Inorganics" and "1.5
 * Vitamins" by food code. Two rows under the header name its columns' codes
 * and labels; "Tr" is a trace and "N" a value not measured.
 */

/** A sheet's cells by food code, read by header name; an absent sheet or column reads as no value. */
async function cellsByCode(file: Uint8Array, sheet: string, sheets: readonly string[]) {
  const [header, ...rows] = sheets.includes(sheet) ? await readSheet(file, sheet) : [];
  const code = header?.findIndex((cell) => cell.trim() === "Food Code") ?? -1;
  const byCode = new Map(rows.map((cells) => [cells[code]?.trim() ?? "", cells]));

  return (foodCode: string, name: string) => {
    const at = header?.findIndex((cell) => cell.trim() === name) ?? -1;

    return at < 0 ? null : compositionValue(byCode.get(foodCode)?.[at]);
  };
}
export async function readCofid(file: Uint8Array): Promise<SourceFood[]> {
  const [header, ...rows] = await readSheet(file, "1.3 Proximates");

  if (!header) throw new Error("The CoFID workbook is empty");

  const index = (name: string) => {
    const found = header.findIndex((cell) => cell.trim() === name);

    if (found < 0) throw new Error(`The CoFID proximates have no "${name}" column`);

    return found;
  };
  const code = index("Food Code");
  const name = index("Food Name");
  const kcal = index("Energy (kcal) (kcal)");
  const fat = index("Fat (g)");
  const carbs = index("Carbohydrate (g)");
  const protein = index("Protein (g)");
  const proximate = (cells: string[], name: string) => {
    const at = header.findIndex((cell) => cell.trim() === name);

    return at < 0 ? null : compositionValue(cells[at]);
  };
  const sheets = await sheetNames(file);
  const inorganic = await cellsByCode(file, "1.4 Inorganics", sheets);
  const vitamin = await cellsByCode(file, "1.5 Vitamins", sheets);

  return rows.flatMap((cells) => {
    const foodCode = cells[code]?.trim();
    const foodName = cells[name]?.trim();
    const numbers = macros({
      kcal: compositionValue(cells[kcal]),
      fat: compositionValue(cells[fat]),
      carbs: compositionValue(cells[carbs]),
      protein: compositionValue(cells[protein]),
    });

    if (!foodCode || !foodName || !numbers) return [];

    const extras = extrasOf({
      saturatedFat: proximate(cells, "Satd FA /100g fd (g)"),
      monounsaturatedFat: proximate(cells, "Mono FA /100g food (g)"),
      polyunsaturatedFat: proximate(cells, "Poly FA /100g food (g)"),
      transFat: proximate(cells, "Trans FAs /100g food (g)"),
      sugars: proximate(cells, "Total sugars (g)"),
      fiber: proximate(cells, "AOAC fibre (g)"),
      cholesterol: proximate(cells, "Cholesterol (mg)"),
      sodium: inorganic(foodCode, "Sodium (mg)"),
      potassium: inorganic(foodCode, "Potassium (mg)"),
      calcium: inorganic(foodCode, "Calcium (mg)"),
      iron: inorganic(foodCode, "Iron (mg)"),
      vitaminC: vitamin(foodCode, "Vitamin C (mg)"),
      vitaminA: vitaminA(vitamin(foodCode, "Retinol (µg)"), vitamin(foodCode, "Carotene (µg)")),
    });

    return [{ code: foodCode, name: foodName, ...numbers, extras }];
  });
}
