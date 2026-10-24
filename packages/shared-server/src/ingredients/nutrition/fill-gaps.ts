/**
 * Fill Gaps: AI's estimate of the numbers per 100 g, density and piece weight a listed food has
 * none of its own for, stored for the whole instance as its own source; and which foods it fills.
 */
import type { NutritionEstimateValues } from "@norish/db/repositories/ingredient-nutrition";
import {
  findCatalogueIngredientNames,
  findIngredientIdsAmong,
  listListedIngredientIds,
} from "@norish/db/repositories/ingredient-catalogue";
import {
  findNutritionLineage,
  saveNutritionEstimate,
} from "@norish/db/repositories/ingredient-nutrition";
import { estimateFoodFacts } from "@norish/shared-server/ai/enrichment/ingredient-nutrition-estimator";

import type { IconFood } from "../icon-rounds";
import type { IconSet } from "../icons";
import type { NutritionGaps } from "./ingredient-nutrition";
import { ingredientChanges } from "../changes";
import { listFoodsShowingNoIcon } from "../icon-rounds";
import { shippedIconSet } from "../icons";
import { findNutritionGaps } from "./ingredient-nutrition";

/** What a fill may ask for: the administrator's options for new foods, or Fill gaps' boxes. */
export interface FillAsked {
  nutrition: boolean;
  conversions: boolean;
}

/** What came of one food's fill. */
export type FillOutcome =
  | { outcome: "filled"; facts: Array<keyof NutritionGaps> }
  | { outcome: "skipped"; reason: "not-found" | "no-gaps" };

/** The gaps `asked` covers. */
function wantedOf(gaps: NutritionGaps, asked: FillAsked): NutritionGaps {
  return {
    numbers: asked.nutrition && gaps.numbers,
    pieceWeight: asked.conversions && gaps.pieceWeight,
    density: asked.conversions && gaps.density,
  };
}

const anyOf = (gaps: NutritionGaps) => gaps.numbers || gaps.pieceWeight || gaps.density;

/** The listed foods among these with a gap `asked` covers, by id and name, in the order given. */
export async function listFoodsWithGaps(
  ingredientIds: readonly string[],
  asked: FillAsked
): Promise<Array<{ id: string; name: string }>> {
  const listed = [...(await findIngredientIdsAmong(ingredientIds, "listed"))];
  const gaps = await findNutritionGaps(listed);
  const names = await findCatalogueIngredientNames(listed);

  return [...new Set(ingredientIds)].flatMap((id) => {
    const found = gaps.get(id);
    const name = names.get(id);

    return found && name && anyOf(wantedOf(found, asked)) ? [{ id, name }] : [];
  });
}

/** What each of Fill gaps' boxes would fill: the listed foods, seeded ones included, with that gap. */
export async function listFillGapsFoods(
  set: IconSet = shippedIconSet()
): Promise<Record<"nutrition" | "conversions" | "icons", IconFood[]>> {
  const listed = await listListedIngredientIds();
  const [nutrition, conversions, icons] = await Promise.all([
    listFoodsWithGaps(listed, { nutrition: true, conversions: false }),
    listFoodsWithGaps(listed, { nutrition: false, conversions: true }),
    listFoodsShowingNoIcon(listed, set),
  ]);

  return { nutrition, conversions, icons };
}

/** Ask AI for one food's gaps `asked` covers and store its answer. Throws what the runtime throws. */
export async function fillNutritionGaps(
  ingredientId: string,
  asked: FillAsked
): Promise<FillOutcome> {
  const gaps = (await findNutritionGaps([ingredientId])).get(ingredientId);

  if (!gaps) return { outcome: "skipped", reason: "not-found" };
  const wanted = wantedOf(gaps, asked);

  if (!anyOf(wanted)) return { outcome: "skipped", reason: "no-gaps" };

  const lineage = await findNutritionLineage([ingredientId]);
  const food = lineage.get(ingredientId);

  if (!food) return { outcome: "skipped", reason: "not-found" };

  // What it is a kind of, nearest first: "pepper", a kind of "spice".
  const kindOf: string[] = [];
  const seen = new Set([food.id]);
  const parentOf = (id: string | null) => (id ? lineage.get(id) : undefined);

  for (let parent = parentOf(food.parentId); parent && !seen.has(parent.id);) {
    seen.add(parent.id);
    kindOf.push(parent.name);
    parent = parentOf(parent.parentId);
  }

  const answer = await estimateFoodFacts({ name: food.name, kindOf }, wanted);
  const values: NutritionEstimateValues = {
    ...(answer.numbers ?? {}),
    ...(answer.pieceWeight !== undefined
      ? { pieceWeight: answer.pieceWeight, pieceless: answer.pieceWeight === null }
      : {}),
    ...(answer.density !== undefined ? { density: answer.density } : {}),
  };

  if (!(await saveNutritionEstimate(ingredientId, values))) {
    return { outcome: "skipped", reason: "not-found" };
  }
  await ingredientChanges().changed([ingredientId]);

  return {
    outcome: "filled",
    facts: (["numbers", "pieceWeight", "density"] as const).filter((fact) => wanted[fact]),
  };
}
