import { listCatalogueForExport } from "@norish/db/repositories/ingredient-seed";

/** Where the catalogue's seed comes from, and under what licence (ADR-0038). */
export const CATALOGUE_SOURCE = {
  name: "Open Food Facts ingredients taxonomy",
  url: "https://world.openfoodfacts.org",
  licence: "Open Database License (ODbL) v1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
} as const;

export interface CatalogueExport {
  source: typeof CATALOGUE_SOURCE;
  exportedAt: string;
  ingredients: Array<{
    id: string;
    name: string;
    parentId: string | null;
    openFoodFactsId: string | null;
    aliases: Array<{ text: string; locale: string | null }>;
  }>;
}

/**
 * The whole ingredient catalogue — every Ingredient, its spellings and its
 * parent — as the machine-readable copy the ODbL asks a derived database be
 * offered in (ADR-0038). It names no one: owners are left out.
 */
export async function buildCatalogueExport(exportedAt: Date): Promise<CatalogueExport> {
  const { ingredients, aliases } = await listCatalogueForExport();
  const byIngredient = new Map<string, Array<{ text: string; locale: string | null }>>();

  for (const alias of aliases) {
    const list = byIngredient.get(alias.ingredientId) ?? [];

    list.push({ text: alias.text, locale: alias.locale });
    byIngredient.set(alias.ingredientId, list);
  }

  return {
    source: CATALOGUE_SOURCE,
    exportedAt: exportedAt.toISOString(),
    ingredients: ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      parentId: ingredient.parentId,
      openFoodFactsId: ingredient.offId,
      aliases: byIngredient.get(ingredient.id) ?? [],
    })),
  };
}
