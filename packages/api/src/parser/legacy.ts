import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";

import { tryExtractRecipeFromJsonLd } from "@norish/api/parser/jsonld";
import { tryExtractRecipeFromMicrodata } from "@norish/api/parser/microdata";

function hasValidLegacyRecipeData(recipe: FullRecipeInsertDTO | null): recipe is FullRecipeInsertDTO {
  return Boolean(
    recipe?.name?.trim() &&
      Array.isArray(recipe.recipeIngredients) &&
      recipe.recipeIngredients.length > 0 &&
      Array.isArray(recipe.steps) &&
      recipe.steps.length > 0
  );
}

/**
 * @deprecated Temporary rollback path for the legacy JSON-LD and microdata parser.
 */
export async function tryLegacyStructuredRecipeParsing(
  url: string,
  html: string,
  recipeId: string
): Promise<FullRecipeInsertDTO | null> {
  const jsonLdParsed = await tryExtractRecipeFromJsonLd(url, html, recipeId);

  if (hasValidLegacyRecipeData(jsonLdParsed)) {
    return jsonLdParsed;
  }

  const microParsed = await tryExtractRecipeFromMicrodata(url, html, recipeId);

  if (hasValidLegacyRecipeData(microParsed)) {
    return microParsed;
  }

  return null;
}
