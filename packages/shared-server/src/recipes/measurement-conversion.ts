/**
 * A recipe's measurements converted without a language model (#599): its
 * lines and steps in the target system, through the shared arithmetic and
 * what the ingredient catalogue knows of each line's food — its density as
 * the household reads it (ADR-0039), and whether it is poured. The caller
 * hands over the copy to convert from; the lines keep their order, so a
 * step's Step Ingredients and images carry over as they are.
 */
import type { NutritionNode } from "@norish/db/repositories/ingredient-nutrition";
import type { FullRecipeDTO, MeasurementSystem } from "@norish/shared/contracts";
import type { FoodMeasure } from "@norish/shared/lib/measurement-conversion";
import { findNutritionLineage } from "@norish/db/repositories/ingredient-nutrition";
import { convertMeasure, convertStepText } from "@norish/shared/lib/measurement-conversion";

import type { NutritionReader } from "../ingredients/nutrition/ingredient-nutrition";
import { resolveIngredientNutrition } from "../ingredients/nutrition/ingredient-nutrition";

/**
 * The taxonomy entries whose foods are poured, with every kind of them below:
 * a cup of these stays a volume in metric, where a cup of any other food the
 * catalogue knows the density of is weighed.
 */
const POURED: ReadonlySet<string> = new Set([
  "en:water",
  "en:milk",
  "en:buttermilk",
  "en:cream",
  "en:oat-milk",
  "en:almond-milk",
  "en:soy-milk",
  "en:coconut-milk",
  "en:broth",
  "en:juice",
  "en:fruit-juice",
  "en:alcohol",
  "en:vinegar",
  "en:oil",
  "en:vegetable-oil",
  "en:sauce",
  "en:syrup",
  "en:maple-syrup",
  "en:agave-syrup",
]);

function isPoured(id: string, lineage: ReadonlyMap<string, NutritionNode>): boolean {
  const seen = new Set<string>();

  for (let node = lineage.get(id); node && !seen.has(node.id);) {
    if (node.offId && POURED.has(node.offId)) return true;

    seen.add(node.id);
    node = node.parentId ? lineage.get(node.parentId) : undefined;
  }

  return false;
}

async function foodMeasures(
  ids: readonly string[],
  reader: NutritionReader
): Promise<Map<string, FoodMeasure>> {
  const [nutrition, lineage] = await Promise.all([
    resolveIngredientNutrition(ids, reader),
    findNutritionLineage(ids),
  ]);

  return new Map(
    ids.map((id) => [
      id,
      { density: nutrition.get(id)?.density?.value ?? null, poured: isPoured(id, lineage) },
    ])
  );
}

export async function convertRecipeMeasurements(
  recipe: Pick<FullRecipeDTO, "recipeIngredients" | "steps">,
  target: MeasurementSystem,
  reader: NutritionReader
) {
  const foods = await foodMeasures(
    [...new Set(recipe.recipeIngredients.flatMap((line) => line.ingredientId ?? []))],
    reader
  );

  return {
    ingredients: recipe.recipeIngredients.map((line) => {
      const converted =
        line.amount != null && line.unit
          ? convertMeasure(
              Number(line.amount),
              line.unit,
              target,
              line.ingredientId ? foods.get(line.ingredientId) : null
            )
          : null;

      return {
        ingredientId: null,
        ingredientName: line.ingredientName,
        order: line.order,
        amount: converted ? converted.amount : line.amount == null ? null : Number(line.amount),
        unit: converted ? converted.unit : line.unit,
        systemUsed: target,
      };
    }),
    steps: recipe.steps.map((step) => ({
      step: convertStepText(step.step, target),
      order: step.order,
      systemUsed: target,
      images: step.images.map(({ image, order }) => ({ image, order })),
      stepIngredients: step.stepIngredients,
    })),
  };
}
