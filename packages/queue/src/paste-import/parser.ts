import { randomUUID } from "crypto";
import YAML from "yaml";

import type { FullRecipeInsertDTO } from "@norish/shared/contracts";
import type { MeasurementSystem } from "@norish/shared/contracts/dto/recipe";
import { getUnits } from "@norish/config/server-config-loader";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";
import { inferSystemUsedFromParsed } from "@norish/shared/lib/determine-recipe-system";
import {
  hasRecipeNameIngredientsAndSteps,
  isUrl,
  parseIngredientWithDefaults,
  parseIsoDuration,
  parseJsonWithRepair,
  stripHtmlTags,
} from "@norish/shared/lib/helpers";
import { normalizeUnit } from "@norish/shared/lib/unit-localization";

import type { PasteImportJobData, StructuredPasteImportRecipe } from "../contracts/job-types";

export const MAX_STRUCTURED_PASTE_RECIPES = 25;

type StructuredRecipeNormalization = {
  recipeId: ReturnType<typeof randomUUID>;
  recipe: FullRecipeInsertDTO | null;
  importedRating: number | null;
};

type PreparedPasteImport = Pick<
  PasteImportJobData,
  "batchId" | "recipeIds" | "text" | "forceAI" | "structuredRecipes"
>;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeMinutes(value: unknown): number | null {
  if (typeof value === "string" && value.trim().toUpperCase().startsWith("PT")) {
    return parseIsoDuration(value.trim()) ?? null;
  }

  const parsed = toFiniteNumber(value);

  return parsed == null ? null : Math.max(0, Math.round(parsed));
}

function extractStructuredRating(value: unknown): number | null {
  const rating = toFiniteNumber(value);

  return rating == null ? null : rating;
}

function extractJsonLdRating(node: Record<string, unknown>): number | null {
  const aggregateRating = node.aggregateRating;

  if (aggregateRating && typeof aggregateRating === "object" && !Array.isArray(aggregateRating)) {
    return extractStructuredRating((aggregateRating as Record<string, unknown>).ratingValue);
  }

  return extractStructuredRating(node.rating);
}

function toNutritionText(value: unknown): string | null {
  const parsed = toFiniteNumber(value);

  return parsed == null ? null : String(parsed);
}

function normalizeYamlTags(value: unknown): { name: string }[] {
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((entry) => stripHtmlTags(entry).trim().toLowerCase())
          .filter(Boolean)
      )
    ).map((name) => ({ name }));
  }

  const parseTags = requireQueueApiHandler("parseTags");

  return parseTags(value);
}

type NormalizedImageEntry = {
  image: string;
  order: number;
};

type NormalizedVideoEntry = {
  video: string;
  thumbnail: string | null;
  duration: number | null;
  order: number;
};

function normalizeMediaEntries(value: unknown, key: "image"): NormalizedImageEntry[];
function normalizeMediaEntries(value: unknown, key: "video"): NormalizedVideoEntry[];
function normalizeMediaEntries(
  value: unknown,
  key: "image" | "video"
): Array<NormalizedImageEntry | NormalizedVideoEntry> {
  const rawValues = Array.isArray(value) ? value : value == null ? [] : [value];

  return rawValues
    .map((entry, index) => {
      if (typeof entry === "string") {
        const url = entry.trim();

        if (!url) {
          return null;
        }

        return key === "image"
          ? { image: url, order: index }
          : { video: url, thumbnail: null, duration: null, order: index };
      }

      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const record = entry as Record<string, unknown>;
        const direct = typeof record[key] === "string" ? record[key].trim() : null;
        const contentUrl = typeof record.contentUrl === "string" ? record.contentUrl.trim() : null;
        const url = direct || contentUrl;

        if (!url) {
          return null;
        }

        return key === "image"
          ? { image: url, order: index }
          : {
              video: url,
              thumbnail:
                typeof record.thumbnail === "string" ? record.thumbnail.trim() || null : null,
              duration: toFiniteNumber(record.duration),
              order: index,
            };
      }

      return null;
    })
    .filter((entry): entry is NormalizedImageEntry | NormalizedVideoEntry => entry !== null);
}

function estimateStructuredRecipeChars(value: unknown): number {
  if (typeof value === "string") {
    return value.trim().length;
  }

  try {
    return YAML.stringify(value).trim().length;
  } catch {
    return JSON.stringify(value)?.length ?? 0;
  }
}

function assertRecipePasteWithinLimit(value: unknown): void {
  const length = estimateStructuredRecipeChars(value);

  if (length > MAX_RECIPE_PASTE_CHARS) {
    throw new Error(`Each pasted recipe must be at most ${MAX_RECIPE_PASTE_CHARS} characters.`);
  }
}

async function normalizeRecipeFromYamlValue(
  rawRecipe: Record<string, unknown>,
  recipeId: string
): Promise<{ recipe: FullRecipeInsertDTO | null; importedRating: number | null }> {
  const parseCategories = requireQueueApiHandler("parseCategories");
  const units = await getUnits();
  const ingredientLines = rawRecipe.ingredients;
  const stepLines = rawRecipe.steps;

  if (!Array.isArray(ingredientLines) || !Array.isArray(stepLines)) {
    return { recipe: null, importedRating: null };
  }

  const normalizedIngredients = ingredientLines
    .map((entry) => (typeof entry === "string" ? stripHtmlTags(entry).trim() : ""))
    .filter(Boolean);
  const normalizedSteps = stepLines
    .map((entry) => (typeof entry === "string" ? stripHtmlTags(entry).trim() : ""))
    .filter(Boolean);

  if (normalizedIngredients.length === 0 || normalizedSteps.length === 0) {
    return { recipe: null, importedRating: null };
  }

  const parsedIngredients = parseIngredientWithDefaults(normalizedIngredients, units);
  const systemUsed = inferSystemUsedFromParsed(parsedIngredients) as MeasurementSystem;

  const recipeIngredients = parsedIngredients.map((ingredient, index) => ({
    ingredientId: null,
    ingredientName: ingredient.description,
    amount: ingredient.quantity != null ? ingredient.quantity : null,
    unit: normalizeUnit(ingredient.unitOfMeasure ?? "", units),
    systemUsed,
    order: index,
  }));

  const images = normalizeMediaEntries(rawRecipe.images ?? rawRecipe.image, "image").map(
    (entry) => ({
      image: String(entry.image),
      order: Number(entry.order ?? 0),
    })
  );
  const videos = normalizeMediaEntries(rawRecipe.videos ?? rawRecipe.video, "video").map(
    (entry) => ({
      video: String(entry.video),
      thumbnail: typeof entry.thumbnail === "string" ? entry.thumbnail : null,
      duration: toFiniteNumber(entry.duration),
      order: Number(entry.order ?? 0),
    })
  );

  const nutrition =
    rawRecipe.nutrition &&
    typeof rawRecipe.nutrition === "object" &&
    !Array.isArray(rawRecipe.nutrition)
      ? (rawRecipe.nutrition as Record<string, unknown>)
      : {};

  const title = typeof rawRecipe.title === "string" ? stripHtmlTags(rawRecipe.title).trim() : "";

  return {
    importedRating: extractStructuredRating(rawRecipe.rating),
    recipe:
      title.length === 0
        ? null
        : {
            id: recipeId,
            name: title,
            description:
              typeof rawRecipe.description === "string"
                ? stripHtmlTags(rawRecipe.description).trim() || null
                : null,
            notes:
              typeof rawRecipe.notes === "string"
                ? stripHtmlTags(rawRecipe.notes).trim() || null
                : null,
            url:
              typeof rawRecipe.sourceUrl === "string" && isUrl(rawRecipe.sourceUrl)
                ? rawRecipe.sourceUrl.trim()
                : null,
            image: images[0]?.image ?? null,
            servings: normalizeMinutes(rawRecipe.servings) ?? 1,
            prepMinutes: normalizeMinutes(rawRecipe.prepMinutes),
            cookMinutes: normalizeMinutes(rawRecipe.cookMinutes),
            totalMinutes: normalizeMinutes(rawRecipe.totalMinutes),
            calories: toFiniteNumber(nutrition.kcal ?? nutrition.calories),
            fat: toNutritionText(nutrition.fat),
            carbs: toNutritionText(nutrition.carbs),
            protein: toNutritionText(nutrition.protein),
            systemUsed,
            steps: normalizedSteps.map((step, index) => ({
              step,
              order: index + 1,
              systemUsed,
            })),
            recipeIngredients,
            tags: normalizeYamlTags(rawRecipe.tags),
            categories: parseCategories(rawRecipe.categories),
            images,
            videos,
          },
  };
}

async function normalizeStructuredRecipes(
  rawRecipes: Array<{ node: Record<string, unknown>; importedRating: number | null }>,
  normalizer: (
    node: Record<string, unknown>,
    recipeId: string
  ) => Promise<{ recipe: FullRecipeInsertDTO | null; importedRating: number | null }>
): Promise<StructuredPasteImportRecipe[]> {
  // Structured paste is an entry point for recipe creation, so each recipe gets
  // exactly one ID here and that same ID must flow through normalization and persistence.
  const normalized: StructuredRecipeNormalization[] = await Promise.all(
    rawRecipes.map(async ({ node }) => {
      const recipeId = randomUUID();
      const entry = await normalizer(node, recipeId);

      return {
        recipeId,
        ...entry,
      };
    })
  );

  return normalized
    .filter(
      (
        entry
      ): entry is StructuredRecipeNormalization & {
        recipe: FullRecipeInsertDTO;
      } => hasRecipeNameIngredientsAndSteps(entry.recipe)
    )
    .map((entry): StructuredPasteImportRecipe => {
      const recipe: FullRecipeInsertDTO = {
        ...entry.recipe,
        id: entry.recipeId,
        url: entry.recipe.url ?? null,
      };

      return {
        recipeId: entry.recipeId,
        recipe,
        importedRating: entry.importedRating,
      };
    });
}

async function parseStructuredJson(text: string): Promise<StructuredPasteImportRecipe[] | null> {
  const extractRecipeNodesFromJsonValue = requireQueueApiHandler("extractRecipeNodesFromJsonValue");
  const normalizeRecipeFromJson = requireQueueApiHandler("normalizeRecipeFromJson");

  let parsedJson: unknown;

  try {
    parsedJson = parseJsonWithRepair(text);
  } catch {
    return null;
  }

  const recipeNodes = extractRecipeNodesFromJsonValue(parsedJson);

  if (recipeNodes.length === 0) {
    return null;
  }

  if (recipeNodes.length > MAX_STRUCTURED_PASTE_RECIPES) {
    throw new Error(`Paste can include at most ${MAX_STRUCTURED_PASTE_RECIPES} recipes.`);
  }

  recipeNodes.forEach(assertRecipePasteWithinLimit);

  return normalizeStructuredRecipes(
    recipeNodes.map((node) => ({ node, importedRating: extractJsonLdRating(node) })),
    async (node, recipeId) => {
      const recipe = await normalizeRecipeFromJson(node, recipeId);

      return { recipe, importedRating: extractJsonLdRating(node) };
    }
  );
}

async function parseStructuredYaml(text: string): Promise<StructuredPasteImportRecipe[] | null> {
  let parsedYaml: unknown;

  try {
    parsedYaml = YAML.parse(text);
  } catch {
    return null;
  }

  const rawRecipes = Array.isArray(parsedYaml) ? parsedYaml : [parsedYaml];
  const recipeMappings = rawRecipes.filter(
    (entry): entry is Record<string, unknown> =>
      !!entry && typeof entry === "object" && !Array.isArray(entry)
  );

  if (recipeMappings.length === 0) {
    return null;
  }

  if (recipeMappings.length > MAX_STRUCTURED_PASTE_RECIPES) {
    throw new Error(`Paste can include at most ${MAX_STRUCTURED_PASTE_RECIPES} recipes.`);
  }

  recipeMappings.forEach(assertRecipePasteWithinLimit);

  return normalizeStructuredRecipes(
    recipeMappings.map((node) => ({ node, importedRating: extractStructuredRating(node.rating) })),
    normalizeRecipeFromYamlValue
  );
}

export async function preparePasteImport(
  text: string,
  forceAI?: boolean
): Promise<PreparedPasteImport> {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("No text provided");
  }

  if (forceAI) {
    if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
      throw new Error(`Paste is too large (max ${MAX_RECIPE_PASTE_CHARS} characters per recipe)`);
    }

    const recipeId = randomUUID();

    return {
      batchId: randomUUID(),
      recipeIds: [recipeId],
      text: trimmed,
      forceAI: true,
    };
  }

  const structuredRecipes = await parseStructuredJson(trimmed);
  const yamlRecipes = structuredRecipes === null ? await parseStructuredYaml(trimmed) : null;
  const preparedStructuredRecipes = structuredRecipes ?? yamlRecipes;

  if (preparedStructuredRecipes && preparedStructuredRecipes.length === 0) {
    throw new Error("No valid recipes found in structured paste input.");
  }

  if (preparedStructuredRecipes) {
    return {
      batchId: randomUUID(),
      recipeIds: preparedStructuredRecipes.map((recipe) => recipe.recipeId),
      text: trimmed,
      forceAI: false,
      structuredRecipes: preparedStructuredRecipes,
    };
  }

  if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
    throw new Error(`Paste is too large (max ${MAX_RECIPE_PASTE_CHARS} characters per recipe)`);
  }

  const recipeId = randomUUID();

  return {
    batchId: randomUUID(),
    recipeIds: [recipeId],
    text: trimmed,
    forceAI: false,
  };
}
