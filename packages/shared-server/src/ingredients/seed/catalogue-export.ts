import type { NutritionCodes } from "@norish/db/schema";
import type {
  NutritionFact,
  NutritionSource,
  Per100g,
} from "@norish/shared/contracts/ingredient-nutrition";
import { listCatalogueForExport } from "@norish/db/repositories/ingredient-seed";

import { NO_HOUSEHOLD, resolveIngredientNutrition } from "../nutrition/ingredient-nutrition";

/** Where the catalogue's seed comes from, and under what licence (ADR-0038). */
export const CATALOGUE_SOURCE = {
  name: "Open Food Facts ingredients taxonomy",
  url: "https://world.openfoodfacts.org",
  licence: "Open Database License (ODbL) v1.0",
  licenceUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
} as const;

/** Where Ingredient Nutrition's numbers come from, and under what terms (ADR-0039). */
export const NUTRITION_SOURCES = [
  {
    name: "Anses. 2025. Ciqual French food composition table (with the 2020 edition for codes 2025 dropped)",
    url: "https://ciqual.anses.fr",
    licence: "Licence Ouverte / Open Licence 2.0 (Etalab)",
  },
  {
    name: "Anses. 2020. Table de composition nutritionnelle Ciqual pour le calcul des apports nutritionnels CALNUT",
    url: "https://ciqual.anses.fr",
    licence: "Licence Ouverte / Open Licence 2.0 (Etalab)",
  },
  {
    name: "USDA FoodData Central: SR Legacy and Foundation Foods",
    url: "https://fdc.nal.usda.gov",
    licence: "CC0 1.0 Universal",
  },
  {
    name: "McCance and Widdowson's Composition of Foods Integrated Dataset (CoFID) 2021",
    url: "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
    licence: "Open Government Licence v3.0",
  },
] as const;

/** One fact as the export states it: the value, the source food (`dataset:code`), and the lender. */
interface ExportedFact<T> {
  value: T;
  /** The dataset food it was taken from, or `taxonomy` for Open Food Facts' own value. */
  source: string;
  /** The Ingredient it was borrowed from, if it was. */
  borrowedFrom: string | null;
}

export interface CatalogueExport {
  source: typeof CATALOGUE_SOURCE;
  nutritionSources: typeof NUTRITION_SOURCES;
  exportedAt: string;
  ingredients: Array<{
    id: string;
    name: string;
    parentId: string | null;
    openFoodFactsId: string | null;
    aliases: Array<{ text: string; locale: string | null }>;
    /** The codes the taxonomy gives the food in the open food datasets. */
    nutritionCodes: NutritionCodes | null;
    /** Its Ingredient Nutrition from the datasets alone, without any household's correction. */
    nutrition: {
      per100g: ExportedFact<Per100g> | null;
      pieceWeight: ExportedFact<number> | null;
      density: ExportedFact<number> | null;
    };
  }>;
}

function sourceKey(source: NutritionSource): string {
  return "food" in source ? `${source.food.dataset}:${source.food.code}` : source.kind;
}

function exported<T>(fact: NutritionFact<T> | null): ExportedFact<T> | null {
  return fact
    ? {
        value: fact.value,
        source: sourceKey(fact.source),
        borrowedFrom: fact.borrowedFrom?.id ?? null,
      }
    : null;
}

/**
 * The whole ingredient catalogue — every Ingredient, its spellings, its
 * parent, its nutrition codes and the numbers the datasets give it — as the
 * machine-readable copy the ODbL asks a derived database be offered in
 * (ADR-0038, ADR-0039). It names no one: owners are left out, and so is
 * every household's correction.
 */
export async function buildCatalogueExport(exportedAt: Date): Promise<CatalogueExport> {
  const { ingredients, aliases } = await listCatalogueForExport();
  const nutrition = await resolveIngredientNutrition(
    ingredients.map((ingredient) => ingredient.id),
    NO_HOUSEHOLD
  );
  const byIngredient = new Map<string, Array<{ text: string; locale: string | null }>>();

  for (const alias of aliases) {
    const list = byIngredient.get(alias.ingredientId) ?? [];

    list.push({ text: alias.text, locale: alias.locale });
    byIngredient.set(alias.ingredientId, list);
  }

  return {
    source: CATALOGUE_SOURCE,
    nutritionSources: NUTRITION_SOURCES,
    exportedAt: exportedAt.toISOString(),
    ingredients: ingredients.map((ingredient) => {
      const facts = nutrition.get(ingredient.id);

      return {
        id: ingredient.id,
        name: ingredient.name,
        parentId: ingredient.parentId,
        openFoodFactsId: ingredient.offId,
        aliases: byIngredient.get(ingredient.id) ?? [],
        nutritionCodes: ingredient.nutritionCodes,
        nutrition: {
          per100g: exported(facts?.numbers ?? null),
          pieceWeight: exported(facts?.pieceWeight ?? null),
          density: exported(facts?.density ?? null),
        },
      };
    }),
  };
}
