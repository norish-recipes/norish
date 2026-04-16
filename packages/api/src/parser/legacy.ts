import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { tryExtractRecipeFromJsonLd } from "@norish/api/parser/jsonld";
import { tryExtractRecipeFromMicrodata } from "@norish/api/parser/microdata";
import { hasRecipeNameIngredientsAndSteps } from "@norish/shared/lib/helpers";

/**
 * @deprecated Temporary rollback path for the legacy JSON-LD and microdata parser.
 */
export async function tryLegacyStructuredRecipeParsing(
  url: string,
  html: string,
  recipeId: string
): Promise<FullRecipeInsertDTO | null> {
  const jsonLdParsed = await tryExtractRecipeFromJsonLd(url, html, recipeId);

  if (hasRecipeNameIngredientsAndSteps(jsonLdParsed)) {
    return jsonLdParsed;
  }

  const microParsed = await tryExtractRecipeFromMicrodata(url, html, recipeId);

  if (hasRecipeNameIngredientsAndSteps(microParsed)) {
    return microParsed;
  }

  return null;
}
