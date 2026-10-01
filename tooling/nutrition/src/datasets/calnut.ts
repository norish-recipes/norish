import type { SourceFood } from "./types";
import { parseRecords } from "../read/csv";
import { compositionValue, macros } from "../read/values";

/**
 * CALNUT 2020 (ANSES): CIQUAL with its gaps filled, keyed by CIQUAL code. Each
 * food comes as a lower, middle and upper bound; the middle one is read. Its
 * labels are French: a food here is named by CIQUAL's English name where one
 * exists, by the caller.
 */
export function readCalnut(text: string): SourceFood[] {
  return parseRecords(text).flatMap((row) => {
    if (row.HYPOTH !== "MB") return [];

    const code = row.alim_code?.trim();
    const name = row.FOOD_LABEL?.trim();
    const numbers = macros({
      kcal: compositionValue(row.nrj_kcal),
      fat: compositionValue(row.lipides_g),
      carbs: compositionValue(row.glucides_g),
      protein: compositionValue(row.proteines_g),
    });

    return code && name && numbers ? [{ code, name, ...numbers }] : [];
  });
}
