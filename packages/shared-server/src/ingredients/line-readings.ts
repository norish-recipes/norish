import type { LineScope } from "@norish/db/repositories/line-readings";
import type { LineReading } from "@norish/shared/lib/line-foods";
import { findIngredientNamesByIds } from "@norish/db/repositories/ingredient-aliases";
import { findLinesOutsideCatalogue } from "@norish/db/repositories/line-readings";
import { getUnits } from "@norish/shared-server/config/server-config-loader";
import { lineFoodText } from "@norish/shared/lib/ingredient-text";

import { knownLineFoods } from "./resolver";

/**
 * How the household uses lines naming a food outside its catalogue (ADR-0042), by line id: each
 * text read in its catalogue as a recipe save would, minting and writing nothing. One batched read.
 */
export async function lineReadingsOf(
  householdId: string,
  scope: LineScope
): Promise<Record<string, LineReading>> {
  const lines = await findLinesOutsideCatalogue(householdId, scope);

  if (lines.length === 0) return {};
  const units = await getUnits();
  const read = await knownLineFoods(
    lines.map((line) =>
      lineFoodText({ text: line.name, amount: line.amount, unit: line.unit }, units)
    ),
    householdId
  );
  const names = await findIngredientNamesByIds(
    householdId,
    read.flatMap((one) => one?.foods.map((food) => food.ingredientId) ?? [])
  );

  return Object.fromEntries(
    lines.map((line, index) => {
      const foods = (read[index]?.foods ?? []).map(({ ingredientId }) => ({
        ingredientId,
        name: names.get(ingredientId) ?? "",
      }));

      return [
        line.id,
        {
          ingredientId: foods[0]?.ingredientId ?? null,
          joined: read[index]?.joined ?? null,
          foods,
        },
      ];
    })
  );
}
