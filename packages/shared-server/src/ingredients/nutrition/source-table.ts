/**
 * The committed source table of Ingredient Nutrition (ADR-0039): every
 * dataset food's four numbers per 100 g, and its piece weight and density
 * where USDA gives a portion for them, plus Norish's own lists — the fix
 * list, the density fixes, the piece fixes, the name matches and the lenders
 * that never lend — keyed by Open Food Facts id. Built by `tooling/nutrition` from the public downloads,
 * read by a pull request's reviewer, and applied by an instance at boot when
 * its version changed. Nothing here is a household's: corrections live
 * apart, so a table refresh never touches them.
 *
 * The file is written one food per line, so a monthly rebuild's pull request
 * diffs as the foods and matches that changed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

/**
 * The datasets a number can come from. `ciqual-2020` holds only the codes
 * CIQUAL 2025 dropped; `calnut` only the codes no CIQUAL edition gives all
 * four numbers for; `usda` is SR Legacy and Foundation Foods, keyed by FDC id.
 */
export const NUTRITION_DATASETS = ["ciqual", "ciqual-2020", "calnut", "usda", "cofid"] as const;

export type NutritionDataset = (typeof NUTRITION_DATASETS)[number];

/** One dataset food: `dataset:code`. */
export type DatasetFoodKey = `${NutritionDataset}:${string}`;

const datasetFoodKey = z.custom<DatasetFoodKey>(
  (value) =>
    typeof value === "string" &&
    NUTRITION_DATASETS.some((dataset) => value.startsWith(`${dataset}:`)) &&
    value.split(":")[1] !== ""
);

const amount = z.number().finite().nonnegative();

/**
 * A food as the file stores it: [dataset, code, name, kcal, fat,
 * carbohydrate, protein, piece weight in g, density in g/ml, NDB number].
 */
const FoodRowSchema = z.tuple([
  z.enum(NUTRITION_DATASETS),
  z.string().min(1),
  z.string().min(1),
  amount,
  amount,
  amount,
  amount,
  amount.positive().nullable(),
  amount.positive().nullable(),
  z.string().nullable(),
]);

export type FoodRow = z.infer<typeof FoodRowSchema>;

export const SourceTableSchema = z
  .object({
    /** A hash of everything below: an instance applies the table when it differs. */
    version: z.string().min(1),
    /** Which edition of each dataset the foods come from, for the credit line. */
    editions: z.partialRecord(z.enum(NUTRITION_DATASETS), z.string()),
    foods: z.array(FoodRowSchema),
    /** Norish's fix list: the dataset food an entry should use, above its own codes. */
    fixes: z.record(z.string(), datasetFoodKey),
    /**
     * Norish's density fixes: the USDA food whose measured spoon or cup an
     * entry's density is taken from, above everything but a household's
     * correction, while its numbers keep their own source.
     */
    densityFixes: z.record(z.string(), datasetFoodKey),
    /**
     * Norish's piece fixes: the dataset food whose piece an entry weighs, or
     * none where it is no piece at all (a zest), for its piece weight alone.
     * Either way the entry never borrows a piece weight: a yolk is no egg.
     */
    pieceFixes: z.record(z.string(), datasetFoodKey.nullable()).default({}),
    /** Name matches for entries without numbers from a code, made by the build script. */
    names: z.record(z.string(), datasetFoodKey),
    /** Entries whose numbers are never lent to their children: a borrow ends there. */
    neverLend: z.array(z.string()),
  })
  .refine(
    (table) =>
      new Set(table.foods.map(([dataset, code]) => `${dataset}:${code}`)).size ===
      table.foods.length,
    { message: "A food is listed twice under one dataset code", path: ["foods"] }
  );

export type SourceTable = z.infer<typeof SourceTableSchema>;

/** One dataset food, as the module reads it. */
export interface DatasetFood {
  dataset: NutritionDataset;
  code: string;
  name: string;
  kcal: number;
  fat: number;
  carbs: number;
  protein: number;
  pieceWeight: number | null;
  density: number | null;
  ndb: string | null;
}

export function foodOf(row: FoodRow): DatasetFood {
  const [dataset, code, name, kcal, fat, carbs, protein, pieceWeight, density, ndb] = row;

  return { dataset, code, name, kcal, fat, carbs, protein, pieceWeight, density, ndb };
}

export function rowOf(food: DatasetFood): FoodRow {
  return [
    food.dataset,
    food.code,
    food.name,
    food.kcal,
    food.fat,
    food.carbs,
    food.protein,
    food.pieceWeight,
    food.density,
    food.ndb,
  ];
}

export function foodKeyOf(food: Pick<DatasetFood, "dataset" | "code">): DatasetFoodKey {
  return `${food.dataset}:${food.code}`;
}

/** Where the committed table lives in the workspace. */
export const SOURCE_TABLE_PATH = join(
  "packages",
  "shared-server",
  "src",
  "ingredients",
  "nutrition",
  "source-table.json"
);

/** The committed table, read and checked. Throws on a file that is not one. */
export function readSourceTable(
  path = resolveExistingWorkspacePath(SOURCE_TABLE_PATH)
): SourceTable {
  return SourceTableSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/**
 * The table as the file holds it: one food or one list entry per line, in a
 * stable order, so a rebuild that changed nothing writes the same bytes and
 * one that changed something diffs as just that.
 */
export function serializeSourceTable(table: SourceTable): string {
  const line = (value: unknown) => JSON.stringify(value);
  const entries = (record: Record<string, string | null>) =>
    Object.keys(record)
      .sort()
      .map((key) => `    ${line(key)}: ${line(record[key])}`)
      .join(",\n");
  const foods = [...table.foods]
    .sort((a, b) => (a[0] === b[0] ? compareCodes(a[1], b[1]) : a[0] < b[0] ? -1 : 1))
    .map((row) => `    ${line(row)}`)
    .join(",\n");
  const editions = Object.fromEntries(
    Object.entries(table.editions).sort(([a], [b]) => (a < b ? -1 : 1))
  );

  return [
    "{",
    `  "version": ${line(table.version)},`,
    `  "editions": ${line(editions)},`,
    `  "fixes": {\n${entries(table.fixes)}\n  },`,
    `  "densityFixes": {\n${entries(table.densityFixes)}\n  },`,
    `  "pieceFixes": {\n${entries(table.pieceFixes)}\n  },`,
    `  "neverLend": [\n${[...table.neverLend]
      .sort()
      .map((id) => `    ${line(id)}`)
      .join(",\n")}\n  ],`,
    `  "names": {\n${entries(table.names)}\n  },`,
    `  "foods": [\n${foods}\n  ]`,
    "}",
    "",
  ].join("\n");
}

function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}
