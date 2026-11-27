import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import type { LineScope } from "@norish/db/repositories/line-readings";
import type { LineJoin, LineReadings } from "@norish/shared/lib/line-foods";
import { findIngredientNamesByIds } from "@norish/db/repositories/ingredient-aliases";
import { findLinesOutsideCatalogue } from "@norish/db/repositories/line-readings";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { lineMeaning } from "@norish/shared/lib/ingredient-text";

import { knownLineFoods } from "./resolver";

/** A line naming a food outside the household's catalogue, as that household reads it. */
export interface ReadLine {
  /** The line's text as written. */
  name: string;
  /** The text it means (`lineMeaning`), which a list add resolves where the read found no food. */
  meaning: string;
  joined: LineJoin | null;
  /** Its text's foods in the household's catalogue, none where it names none there. */
  foods: Array<IngredientRef & { name: string }>;
}

/**
 * The lines in `scope` naming a food outside the household's catalogue (ADR-0042), by line id, each
 * read in that catalogue as a recipe save would, minting and writing nothing. One batched read.
 */
export async function readLines(
  householdId: string,
  scope: LineScope
): Promise<Map<string, ReadLine>> {
  const lines = await findLinesOutsideCatalogue(householdId, scope);

  if (lines.length === 0) return new Map();
  const units = await getUnits();
  const meanings = lines.map((line) =>
    lineMeaning({ text: line.name, amount: line.amount, unit: line.unit }, units)
  );
  const read = await knownLineFoods(meanings, householdId);
  const names = await findIngredientNamesByIds(
    householdId,
    read.flatMap((one) => one?.foods.map((food) => food.ingredientId) ?? [])
  );

  return new Map(
    lines.map((line, index) => [
      line.id,
      {
        name: line.name,
        meaning: meanings[index]!,
        joined: read[index]?.joined ?? null,
        foods: (read[index]?.foods ?? []).map(({ aliasId, ingredientId }) => ({
          aliasId,
          ingredientId,
          name: names.get(ingredientId) ?? "",
        })),
      },
    ])
  );
}

/**
 * The food an untouched chip of a read line is, by the food it names: that read food, else the one at
 * the stored food's place (`{}` where the line reads none there); undefined where it is not the line's.
 */
export function chipFood(
  line: ReadLine,
  stored: readonly IngredientRef[] | undefined,
  ingredientId: string
): { food?: ReadLine["foods"][number] } | undefined {
  const read = line.foods.find((food) => food.ingredientId === ingredientId);

  if (read) return { food: read };
  const place = stored?.findIndex((food) => food.ingredientId === ingredientId) ?? -1;

  return place < 0 ? undefined : { food: line.foods[place] };
}

/** How the household uses the lines in `scope` naming a food outside its catalogue (`readLines`). */
export async function lineReadingsOf(householdId: string, scope: LineScope): Promise<LineReadings> {
  return Object.fromEntries(
    [...(await readLines(householdId, scope))].map(([id, { joined, foods }]) => [
      id,
      {
        ingredientId: foods[0]?.ingredientId ?? null,
        joined,
        foods: foods.map(({ ingredientId, name }) => ({ ingredientId, name })),
      },
    ])
  );
}
