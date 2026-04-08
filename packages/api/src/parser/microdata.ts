/**
 * @deprecated Legacy rollback parser helpers kept only for `LEGACY_RECIPE_PARSER_ROLLBACK`.
 * Microdata helpers: parse HTML microdata and return normalized Recipe-like objects.
 */
import { createRequire } from "node:module";

import { normalizeRecipeFromJson } from "@norish/api/parser/normalize";
import { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";

import { extractImageCandidates } from "./parsers";

const require = createRequire(import.meta.url);
const microdata = require("microdata-node") as {
  toJson(input: string): { items?: unknown[] };
};

function hasImage(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;

  const imageField = (node as { image?: unknown }).image;

  if (typeof imageField === "string") return imageField.trim().length > 0;
  if (Array.isArray(imageField)) return imageField.length > 0;
  if (imageField && typeof imageField === "object") return true;

  return false;
}

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

  const firstNode = nodes[0] as Record<string, unknown>;

  if (!hasImage(firstNode)) {
    const candidates = extractImageCandidates(htmlContent, url);

    if (candidates.length > 0) {
      firstNode.image = candidates;
    }
  }

  const parsed = await normalizeRecipeFromJson(firstNode, recipeId);

  parsed && (parsed.url = url);

  return parsed;
}
