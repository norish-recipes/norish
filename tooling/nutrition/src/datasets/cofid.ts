import type { SourceFood } from "./types";
import { compositionValue, macros } from "../read/values";
import { readSheet } from "../read/xlsx";

/**
 * CoFID 2021, McCance and Widdowson's (UK, OGL v3): the "1.3 Proximates"
 * sheet. Two rows under the header name its columns' codes and labels; "Tr"
 * is a trace and "N" a value not measured.
 */
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

  return rows.flatMap((cells) => {
    const foodCode = cells[code]?.trim();
    const foodName = cells[name]?.trim();
    const numbers = macros({
      kcal: compositionValue(cells[kcal]),
      fat: compositionValue(cells[fat]),
      carbs: compositionValue(cells[carbs]),
      protein: compositionValue(cells[protein]),
    });

    return foodCode && foodName && numbers ? [{ code: foodCode, name: foodName, ...numbers }] : [];
  });
}
