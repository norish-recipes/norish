import JSZip from "jszip";

import type { Portion } from "../portions";
import type { SourceFood } from "./types";
import { densityOf, pieceWeightOf } from "../portions";
import { parseRecords } from "../read/csv";
import { compositionValue, macros } from "../read/values";

/**
 * USDA FoodData Central (CC0): SR Legacy and Foundation Foods, from their CSV
 * downloads, keyed by FDC id. Energy is the "Energy (kcal)" nutrient, else
 * the Atwater specific, else the general factors; carbohydrate is by
 * difference, else by summation. A food's portions give its piece weight and
 * density.
 */
export interface UsdaFood extends SourceFood {
  /** The SR Legacy NDB number the taxonomy's `usda_ndb_code` names it by. */
  ndb: string | null;
  pieceWeight: number | null;
  density: number | null;
}

const NUTRIENTS = {
  kcal: ["1008", "2048", "2047"],
  protein: ["1003"],
  fat: ["1004"],
  carbs: ["1005", "1050"],
} as const;

async function csvFiles(file: Uint8Array): Promise<Map<string, string>> {
  const zip = await JSZip.loadAsync(file);
  const files = new Map<string, string>();

  for (const entry of Object.values(zip.files)) {
    if (!entry.dir && entry.name.endsWith(".csv")) {
      files.set(entry.name.split("/").pop()!, await entry.async("string"));
    }
  }

  return files;
}

function need(files: Map<string, string>, name: string): string {
  const text = files.get(name);

  if (text === undefined) throw new Error(`The USDA download has no ${name}`);

  return text;
}

/** The foods of one download: SR Legacy's every food, or Foundation's foundation foods. */
export async function readUsda(
  file: Uint8Array,
  kind: "sr-legacy" | "foundation"
): Promise<UsdaFood[]> {
  const files = await csvFiles(file);
  const listing = parseRecords(
    need(files, kind === "sr-legacy" ? "sr_legacy_food.csv" : "foundation_food.csv")
  );
  const ndbOf = new Map(listing.map((row) => [row.fdc_id!, row.NDB_number?.trim() || null]));
  const descriptions = new Map(
    parseRecords(need(files, "food.csv"))
      .filter((row) => ndbOf.has(row.fdc_id!))
      .map((row) => [row.fdc_id!, row.description!.trim()])
  );
  const amounts = new Map<string, Map<string, string>>();

  for (const row of parseRecords(need(files, "food_nutrient.csv"))) {
    if (!descriptions.has(row.fdc_id!)) continue;

    const food = amounts.get(row.fdc_id!) ?? new Map<string, string>();

    food.set(row.nutrient_id!, row.amount!);
    amounts.set(row.fdc_id!, food);
  }

  const units = new Map(
    parseRecords(need(files, "measure_unit.csv")).map((row) => [row.id!, row.name!])
  );
  const portions = new Map<string, Portion[]>();

  for (const row of parseRecords(need(files, "food_portion.csv"))) {
    if (!descriptions.has(row.fdc_id!)) continue;

    const list = portions.get(row.fdc_id!) ?? [];

    list.push({
      amount: Number(row.amount || "1"),
      unit: units.get(row.measure_unit_id!) ?? "",
      modifier: `${row.portion_description ?? ""} ${row.modifier ?? ""}`.trim(),
      grams: Number(row.gram_weight),
    });
    portions.set(row.fdc_id!, list);
  }

  return [...descriptions].flatMap(([fdcId, name]) => {
    const nutrients = amounts.get(fdcId) ?? new Map<string, string>();
    const first = (ids: readonly string[]) =>
      ids.map((id) => compositionValue(nutrients.get(id))).find((value) => value !== null) ?? null;
    const numbers = macros({
      kcal: first(NUTRIENTS.kcal),
      fat: first(NUTRIENTS.fat),
      carbs: first(NUTRIENTS.carbs),
      protein: first(NUTRIENTS.protein),
    });
    const own = portions.get(fdcId) ?? [];

    return numbers
      ? [
          {
            code: fdcId,
            name,
            ndb: kind === "sr-legacy" ? (ndbOf.get(fdcId) ?? null) : null,
            ...numbers,
            pieceWeight: pieceWeightOf(own),
            density: densityOf(own),
          },
        ]
      : [];
  });
}
