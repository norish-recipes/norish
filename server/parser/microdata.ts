/** Microdata helpers: parse HTML microdata and return normalized Recipe-like objects. */
// microdata-node has no official types; import as any
// @ts-expect-error microdata-node has no types
import microdata from "microdata-node";

import { normalizeRecipeFromJson } from "@/server/parser/normalize";
import { extractImageCandidates } from "@/server/parser/parsers/images";
import { FullRecipeInsertDTO } from "@/types/dto/recipe";

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

  const node = nodes[0];

  // If node has no image, try to extract from HTML
  if (!node.image || (Array.isArray(node.image) && node.image.length === 0)) {
    node.image = extractImageCandidates(htmlContent, url);
  }

  const parsed = await normalizeRecipeFromJson(node, recipeId);

  parsed && (parsed.url = url);

  return parsed;
}
