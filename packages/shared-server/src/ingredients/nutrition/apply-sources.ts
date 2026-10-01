/**
 * Applying Ingredient Nutrition's source table on an instance (ADR-0039):
 * the table arrives with a release, and boot applies it when its version
 * differs from the one recorded beside the seed state. The whole table is
 * swapped in one transaction, so a failed apply leaves the last good one,
 * and the version is recorded only once it is in. Households' corrections
 * are never touched.
 */
import { replaceNutritionSources } from "@norish/db/repositories/ingredient-nutrition";
import { createLogger } from "@norish/shared-server/logger";

import type { SourceTable } from "./source-table";
import { readIngredientSeedState, updateIngredientSeedState } from "../seed/catalogue-seed";
import { foodOf, readSourceTable } from "./source-table";

const log = createLogger("ingredient-nutrition");

/** Apply a table as it is, replacing whatever source numbers the instance had. */
export async function applySourceTable(table: SourceTable): Promise<void> {
  await replaceNutritionSources(table.foods.map(foodOf), [
    ...Object.entries(table.fixes).map(([offId, food]) => ({ offId, kind: "fix", food })),
    ...Object.entries(table.names).map(([offId, food]) => ({ offId, kind: "name", food })),
    ...table.neverLend.map((offId) => ({ offId, kind: "never-lend", food: null })),
  ]);
}

/**
 * Apply the release's table where its version is not the one last applied.
 * Answers the version applied, or null where nothing changed. Throws, having
 * changed nothing, where the table cannot be read or applied.
 */
export async function applySourceTableOnVersionChange(
  read: () => SourceTable = readSourceTable
): Promise<string | null> {
  const state = await readIngredientSeedState();
  const table = read();

  if (state.nutritionVersion === table.version) return null;

  await applySourceTable(table);
  await updateIngredientSeedState({ nutritionVersion: table.version });
  log.info(
    { version: table.version, foods: table.foods.length, previous: state.nutritionVersion },
    "Ingredient Nutrition source table applied"
  );

  return table.version;
}
