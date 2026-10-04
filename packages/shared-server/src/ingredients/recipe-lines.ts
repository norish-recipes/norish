import type { IngredientResolutions } from "@norish/db/repositories/ingredients";
import type { MutationOutcome } from "@norish/db/repositories/mutation-outcomes";
import type {
  CreateRecipeResult,
  WithIngredientResolutions,
} from "@norish/db/repositories/recipes";
import type { FullRecipeInsertDTO, FullRecipeUpdateDTO } from "@norish/shared/contracts";
import { findIngredientNamesByIds } from "@norish/db/repositories/ingredient-aliases";
import { createRecipeWithRefs, updateRecipeWithRefs } from "@norish/db/repositories/recipes";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";

import type { ResolveActor } from "./resolver";
import { cleanIngredientText, resolveIngredients, writeResolved } from "./resolver";

interface RecipeLineInput {
  ingredientId?: string | null;
  ingredientName?: string;
}

/**
 * Resolve a recipe payload's line texts before the recipe is written, which
 * is the only way a recipe write accepts them. Each line's text is its
 * `ingredientName` as written; a line that names only an Ingredient by id is
 * given that Ingredient's name as its text. A line left with no text is
 * dropped, as the recipe write always skipped it, and one that names no
 * food (a heading, a text with no letter or digit) is written as it is.
 */
export async function withResolvedIngredients<
  L extends RecipeLineInput,
  P extends { recipeIngredients?: L[] },
>(payload: P, actor: ResolveActor): Promise<WithIngredientResolutions<P>> {
  const lines = payload.recipeIngredients;

  if (!lines?.length) return { ...payload, ingredientResolutions: new Map() };

  const namesById = await findIngredientNamesByIds(
    lines.flatMap((line) =>
      !cleanIngredientText(line.ingredientName ?? "") && line.ingredientId
        ? [line.ingredientId]
        : []
    )
  );
  // A line whose text is markup alone names no food and is no line.
  const written = lines.flatMap((line) => {
    const text =
      cleanIngredientText(line.ingredientName ?? "") ||
      cleanIngredientText(namesById.get(line.ingredientId ?? "") ?? "");

    return text ? [{ ...line, ingredientName: text }] : [];
  });
  const texts = Array.from(
    new Set(
      written.flatMap((line) =>
        line.ingredientName && !namesNoFood(line.ingredientName) ? [line.ingredientName] : []
      )
    )
  );
  const resolved: IngredientResolutions = new Map(
    (await resolveIngredients(texts, actor)).map((row) => [
      row.text,
      { aliasId: row.aliasId, ingredientId: row.ingredientId },
    ])
  );

  return { ...payload, recipeIngredients: written, ingredientResolutions: resolved };
}

/**
 * Create a recipe with its lines resolved: the one way a recipe is written
 * from a payload. Resolved again should a food go away before the write.
 */
export function createResolvedRecipe(
  recipeId: string,
  userId: string | null | undefined,
  payload: FullRecipeInsertDTO,
  actor: ResolveActor
): Promise<CreateRecipeResult | null> {
  return writeResolved(
    () => withResolvedIngredients(payload, actor),
    (resolved) => createRecipeWithRefs(recipeId, userId, resolved)
  );
}

/** Update a recipe with its lines resolved, as `createResolvedRecipe` creates one. */
export function updateResolvedRecipe(
  recipeId: string,
  userId: string,
  payload: FullRecipeUpdateDTO,
  actor: ResolveActor,
  version?: number
): Promise<MutationOutcome<void>> {
  return writeResolved(
    () => withResolvedIngredients(payload, actor),
    (resolved) => updateRecipeWithRefs(recipeId, userId, resolved, version)
  );
}
