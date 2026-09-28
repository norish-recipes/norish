import type { IngredientResolutions } from "@norish/db/repositories/ingredients";
import type { WithIngredientResolutions } from "@norish/db/repositories/recipes";
import { findIngredientNamesByIds } from "@norish/db/repositories/ingredient-aliases";

import type { ResolveActor } from "./resolver";
import { cleanIngredientText, resolveIngredients } from "./resolver";

interface RecipeLineInput {
  ingredientId?: string | null;
  ingredientName?: string;
}

/**
 * Resolve a recipe payload's line texts before the recipe is written, which
 * is the only way a recipe write accepts them. Each line's text is its
 * `ingredientName` as written; a line that names only an Ingredient by id is
 * given that Ingredient's name as its text. A line left with no text is
 * dropped, as the recipe write always skipped it.
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
    new Set(written.flatMap((line) => (line.ingredientName ? [line.ingredientName] : [])))
  );
  const resolved: IngredientResolutions = new Map(
    (await resolveIngredients(texts, actor)).map((row) => [
      row.text,
      { aliasId: row.aliasId, ingredientId: row.ingredientId },
    ])
  );

  return { ...payload, recipeIngredients: written, ingredientResolutions: resolved };
}
