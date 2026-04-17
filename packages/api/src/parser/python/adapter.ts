import type { RecipeCategory } from "@norish/shared/contracts";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { parseImages } from "@norish/api/parser/parsers/images";
import { parseIngredients } from "@norish/api/parser/parsers/ingredients";
import { getServings } from "@norish/api/parser/parsers/metadata";
import { extractNutrition } from "@norish/api/parser/parsers/nutrition";
import { parseSteps } from "@norish/api/parser/parsers/steps";
import { parseVideos } from "@norish/api/parser/parsers/videos";
import { getUnits } from "@norish/config/server-config-loader";
import { parserLogger as log } from "@norish/shared-server/logger";
import { hasRecipeName } from "@norish/shared/lib/helpers";

import type { RecipeScrapersParserSuccess } from "./contract";

type ScraperRecipe = RecipeScrapersParserSuccess["recipe"];
type EmbeddedVideo = RecipeScrapersParserSuccess["media"]["videos"][number];

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  return trimmed || undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((item): item is string => Boolean(item));
  }

  const single = normalizeString(value);

  return single ? [single] : [];
}

function normalizeDelimitedStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeDelimitedStrings(item));
  }

  const single = normalizeString(value);

  if (!single) return [];

  return single
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectIngredientStrings(recipe: ScraperRecipe): string[] {
  const direct = normalizeStringList(recipe.ingredients);

  if (direct.length > 0) return direct;

  const groups = Array.isArray(recipe.ingredient_groups) ? recipe.ingredient_groups : [];

  return groups.flatMap((group) => {
    if (!group || typeof group !== "object") return [];
    const ingredients = (group as { ingredients?: unknown }).ingredients;

    return normalizeStringList(ingredients);
  });
}

function collectInstructionSource(recipe: ScraperRecipe): unknown {
  const structuredInstructions = (recipe as Record<string, unknown>).recipeInstructions;

  if (structuredInstructions !== undefined && structuredInstructions !== null) {
    return structuredInstructions;
  }

  const list = normalizeStringList(recipe.instructions_list);

  if (list.length > 0) return list;

  const instructions = normalizeString(recipe.instructions);

  if (!instructions) return [];

  return instructions
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);
}

// TODO: This needs to become a setting in admin/user settings as the tags often do not make sense.
// For now its unused.
function collectTagCandidates(recipe: ScraperRecipe): string[] {
  return [
    ...normalizeDelimitedStrings(recipe.keywords),
    ...normalizeDelimitedStrings(recipe.category),
    ...normalizeDelimitedStrings(recipe.cuisine),
    ...normalizeDelimitedStrings(recipe.cooking_method),
    ...normalizeDelimitedStrings(recipe.dietary_restrictions),
  ];
}

// TODO: This needs to become a setting in admin/user settings as the tags often do not make sense.
// For now its unused.
function normalizeTags(recipe: ScraperRecipe): { name: string }[] {
  const seen = new Set<string>();

  return collectTagCandidates(recipe)
    .map((tag) => tag.trim().toLowerCase())
    .map((tag) => tag.replace(/\s+/g, " "))
    .filter((tag) => tag.length > 0)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);

      return true;
    })
    .map((name) => ({ name }));
}

function adaptEmbeddedVideos(videos: EmbeddedVideo[]) {
  return videos.map((video) => ({
    "@type": "VideoObject" as const,
    ...video,
  }));
}

function mapCategories(recipe: ScraperRecipe): RecipeCategory[] {
  const values = [
    ...normalizeDelimitedStrings(recipe.category),
    ...normalizeDelimitedStrings(recipe.keywords),
  ].map((value) => value.trim().toLowerCase());

  const categoryMap: Record<string, RecipeCategory> = {
    breakfast: "Breakfast",
    brunch: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    supper: "Dinner",
    snack: "Snack",
    appetizer: "Snack",
    dessert: "Snack",
    "side dish": "Snack",
  };

  const categories = new Set<RecipeCategory>();

  for (const value of values) {
    const category = categoryMap[value];

    category && categories.add(category);
  }

  return [...categories];
}

function buildNutrition(recipe: ScraperRecipe) {
  const nutrients = recipe.nutrients;
  const nutrition = nutrients && typeof nutrients === "object" ? nutrients : {};

  return extractNutrition({
    nutrition: {
      calories:
        (nutrition as Record<string, unknown>).calories ??
        (nutrition as Record<string, unknown>).calorieContent,
      fatContent:
        (nutrition as Record<string, unknown>).fatContent ??
        (nutrition as Record<string, unknown>).fat,
      carbohydrateContent:
        (nutrition as Record<string, unknown>).carbohydrateContent ??
        (nutrition as Record<string, unknown>).carbs,
      proteinContent:
        (nutrition as Record<string, unknown>).proteinContent ??
        (nutrition as Record<string, unknown>).protein,
    },
  });
}

function hasRequiredRecipeFields(recipe: FullRecipeInsertDTO): boolean {
  return hasRecipeName(recipe);
}

export async function adaptRecipeScrapersResponse(
  success: RecipeScrapersParserSuccess,
  recipeId: string,
  originalUrl: string
): Promise<FullRecipeInsertDTO | null> {
  const recipe = success.recipe;
  const title = normalizeString(recipe.title);

  if (!title) {
    log.warn(
      { canonicalUrl: success.canonicalUrl, title: recipe.title },
      "Recipe parser result did not include a valid title"
    );

    return null;
  }

  const units = await getUnits();
  const ingredientStrings = collectIngredientStrings(recipe);
  const { ingredients: recipeIngredients, systemUsed } = parseIngredients(
    { ingredients: ingredientStrings },
    units
  );
  const steps = parseSteps(collectInstructionSource(recipe), systemUsed);
  const imageSource = recipe.image ?? success.media.images;
  const { images, primaryImage } = await parseImages(imageSource, recipeId);
  const { videos } = await parseVideos(adaptEmbeddedVideos(success.media.videos), recipeId);
  const nutrition = buildNutrition(recipe);

  const dto: FullRecipeInsertDTO = {
    id: recipeId,
    name: title,
    description: normalizeString(recipe.description),
    notes: undefined,
    url: success.canonicalUrl ?? originalUrl,
    image: primaryImage,
    servings: getServings(recipe.yields),
    prepMinutes: typeof recipe.prep_time === "number" ? recipe.prep_time : undefined,
    cookMinutes: typeof recipe.cook_time === "number" ? recipe.cook_time : undefined,
    totalMinutes: typeof recipe.total_time === "number" ? recipe.total_time : undefined,
    calories: nutrition.calories,
    fat: nutrition.fat,
    carbs: nutrition.carbs,
    protein: nutrition.protein,
    systemUsed,
    steps,
    recipeIngredients,
    // Temporary: do not auto-apply parser-supplied tags from scraped recipe data.
    // This is because the tags are often not very useful when supplied by the parser.
    // Should become a user-configurable setting in admin/user settings.
    // tags: normalizeTags(recipe),
    tags: [],
    categories: mapCategories(recipe),
    images,
    videos,
  };

  if (!hasRequiredRecipeFields(dto)) {
    log.warn(
      {
        canonicalUrl: success.canonicalUrl,
        ingredientCount: recipeIngredients.length,
        stepCount: steps.length,
        title: dto.name,
      },
      "Recipe parser result did not include a valid title"
    );

    return null;
  }

  return dto;
}
