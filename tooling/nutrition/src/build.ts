import { createHash } from "node:crypto";

import type {
  DatasetFood,
  DatasetFoodKey,
  NutritionDataset,
  SourceTable,
} from "@norish/shared-server/ingredients/nutrition/source-table";
import type { NutritionCodes } from "@norish/shared-server/ingredients/seed/parse-taxonomy";
import {
  foodKeyOf,
  rowOf,
  serializeSourceTable,
} from "@norish/shared-server/ingredients/nutrition/source-table";
import { parseTaxonomy } from "@norish/shared-server/ingredients/seed/parse-taxonomy";

import type { SourceFood } from "./datasets/types";
import type { Sources } from "./sources";
import { indexByName, matchByName } from "./names";

/** Norish's own lists, as the table carries them. */
export interface Lists {
  fixes: Readonly<Record<string, DatasetFoodKey>>;
  neverLend: readonly string[];
}

export class SourceTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceTableError";
  }
}

function asFood(dataset: NutritionDataset, food: SourceFood): DatasetFood {
  return { dataset, ...food, pieceWeight: null, density: null, ndb: null };
}

/**
 * Every dataset food the table keeps: CIQUAL 2025; CIQUAL 2020 for the codes
 * 2025 gives no numbers for; CALNUT for the codes neither does, named by
 * CIQUAL's English name where either edition has one; all of USDA; all of
 * CoFID.
 */
export function tableFoods(sources: Sources): DatasetFood[] {
  const ciqual = new Map(sources.ciqual.foods.map((food) => [food.code, food]));
  const ciqual2020 = sources.ciqual2020.foods.filter((food) => !ciqual.has(food.code));
  const counted = new Set([...ciqual.keys(), ...ciqual2020.map((food) => food.code)]);
  const english = new Map([...sources.ciqual2020.names, ...sources.ciqual.names]);
  const calnut = sources.calnut
    .filter((food) => !counted.has(food.code))
    .map((food) => ({ ...food, name: english.get(food.code) ?? food.name }));

  return withoutAmbiguousCodes([
    ...sources.ciqual.foods.map((food) => asFood("ciqual", food)),
    ...ciqual2020.map((food) => asFood("ciqual-2020", food)),
    ...calnut.map((food) => asFood("calnut", food)),
    ...sources.usda.map((food) => ({ dataset: "usda" as const, ...food })),
    ...sources.cofid.map((food) => asFood("cofid", food)),
  ]);
}

/**
 * The foods without any code a dataset gives two of them: such a code names
 * no one food (CoFID 2021 gives 13-669 to both a roasted aubergine and
 * watercress), so neither is kept rather than guessing which it means.
 */
function withoutAmbiguousCodes(foods: readonly DatasetFood[]): DatasetFood[] {
  const counts = new Map<string, number>();

  for (const food of foods) {
    const key = foodKeyOf(food);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return foods.filter((food) => counts.get(foodKeyOf(food)) === 1);
}

/** Whether an entry's own codes give it numbers from the table's foods. */
function numbersFromCodes(
  codes: NutritionCodes | null,
  byKey: ReadonlyMap<string, DatasetFood>,
  byNdb: ReadonlyMap<string, DatasetFood>
): boolean {
  if (!codes) return false;

  const ciqual = (code: string) =>
    byKey.has(`ciqual:${code}`) || byKey.has(`ciqual-2020:${code}`) || byKey.has(`calnut:${code}`);
  const usda = (code: string) => {
    const [kind, value] = code.split(":");

    return kind === "ndb" ? byNdb.has(value!) : byKey.has(`usda:${value}`);
  };

  return codes.ciqual.some(ciqual) || codes.usda.some(usda) || codes.ciqualOther.some(ciqual);
}

/**
 * Build the table from the datasets and Norish's lists. Throws, writing
 * nothing, where a fix-list entry names a food the datasets no longer have,
 * or a list names an entry the taxonomy no longer has: a broken fix never
 * reaches an instance.
 */
export function buildSourceTable(
  sources: Sources,
  lists: Lists,
  editions: SourceTable["editions"]
): SourceTable {
  const foods = tableFoods(sources);
  const byKey = new Map(foods.map((food) => [foodKeyOf(food), food]));
  const byNdb = new Map(foods.flatMap((food) => (food.ndb ? [[food.ndb, food] as const] : [])));
  const entries = parseTaxonomy(sources.taxonomy);
  const ids = new Set(entries.map((entry) => entry.id));
  const problems = [
    ...Object.entries(lists.fixes)
      .filter(([, key]) => !byKey.has(key))
      .map(([id, key]) => `the fix for ${id} names ${key}, which no dataset has`),
    ...Object.keys(lists.fixes)
      .filter((id) => !ids.has(id))
      .map((id) => `the fix list names ${id}, which the taxonomy does not have`),
    ...lists.neverLend
      .filter((id) => !ids.has(id))
      .map((id) => `the lenders that never lend name ${id}, which the taxonomy does not have`),
  ];

  if (problems.length > 0)
    throw new SourceTableError(`The source table cannot be built: ${problems.join("; ")}`);

  const indexes = [
    indexByName(
      foods.filter((food) => food.dataset === "ciqual" || food.dataset === "ciqual-2020")
    ),
    indexByName(foods.filter((food) => food.dataset === "usda")),
    indexByName(foods.filter((food) => food.dataset === "cofid")),
  ];
  const names: Record<string, DatasetFoodKey> = {};

  for (const entry of entries) {
    if (lists.fixes[entry.id] || numbersFromCodes(entry.nutrition, byKey, byNdb)) continue;

    const english = entry.names
      .filter((name) => name.locale === "en" || name.locale === null)
      .map((name) => name.text);
    const match = matchByName(english, indexes);

    if (match) names[entry.id] = foodKeyOf(match);
  }

  const table: SourceTable = {
    version: "",
    editions,
    foods: foods.map(rowOf),
    fixes: { ...lists.fixes },
    names,
    neverLend: [...lists.neverLend],
  };

  return { ...table, version: versionOf(table) };
}

/** The table's version: a hash of what it holds, so an unchanged rebuild keeps it. */
function versionOf(table: SourceTable): string {
  return createHash("sha256")
    .update(serializeSourceTable({ ...table, version: "-" }))
    .digest("hex")
    .slice(0, 16);
}
