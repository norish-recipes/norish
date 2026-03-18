/** Microdata helpers: parse HTML microdata and return normalized Recipe-like objects. */
// microdata-node has no official types; import as any
// @ts-expect-error microdata-node has no types
import microdata from "microdata-node";
import { normalizeRecipeFromJson } from "@norish/api/parser/normalize";
import { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";

/**
 * Extract microdata items and return a best-effort Recipe object array.
 */
export function extractMicrodataRecipes(htmlContent: string): any[] {
  try {
    const result = microdata.toJson(htmlContent);
    const items = Array.isArray(result?.items) ? result.items : [];
    const recipes = items.filter((item: any) => {
      const types = Array.isArray(item?.type)
        ? item.type.map((t: any) => String(t).toLowerCase())
        : [];

      return types.some((t: string) => t.includes("schema.org/recipe") || t === "recipe");
    });

    return recipes.map((r: any) => {
      const props = (r?.properties ?? {}) as Record<string, any>;

      return { "@type": "Recipe", ...props };
    });
  } catch {
    return [];
  }
}

export async function tryExtractRecipeFromMicrodata(
  url: string,
  htmlContent: string,
  recipeId: string
): Promise<FullRecipeInsertDTO | null> {
  const nodes = extractMicrodataRecipes(htmlContent);

  if (!nodes || nodes.length === 0) return null;

  const parsed = await normalizeRecipeFromJson(nodes[0], recipeId);

  parsed && (parsed.url = url);

  return parsed;
}
