import type { SourceFood } from "./types";
import { parseRecords } from "../read/csv";
import { compositionValue, extrasOf, macros, vitaminA } from "../read/values";

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

    const extras = extrasOf({
      saturatedFat: compositionValue(row.ags_g),
      monounsaturatedFat: compositionValue(row.agmi_g),
      polyunsaturatedFat: compositionValue(row.agpi_g),
      sugars: compositionValue(row.sucres_g),
      fiber: compositionValue(row.fibres_g),
      cholesterol: compositionValue(row.cholesterol_mg),
      sodium: compositionValue(row.sodium_mg),
      potassium: compositionValue(row.potassium_mg),
      calcium: compositionValue(row.calcium_mg),
      iron: compositionValue(row.fer_mg),
      vitaminC: compositionValue(row.vitamine_c_mg),
      vitaminA: vitaminA(
        compositionValue(row.retinol_mcg),
        compositionValue(row.beta_carotene_mcg)
      ),
    });

    return code && name && numbers ? [{ code, name, ...numbers, extras }] : [];
  });
}
