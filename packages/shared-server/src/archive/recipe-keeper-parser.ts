import * as cheerio from "cheerio";
import JSZip from "jszip";

import { matchCategory } from "@norish/shared-server/ai/enrichment/category-matcher";
import { FullRecipeInsertDTO } from "@norish/shared/contracts";
import { parseIsoDuration } from "@norish/shared/lib/helpers";
import { MAX_RECIPE_IMAGES } from "@norish/shared/lib/recipe-media";

import {
  buildRecipeDTO,
  parseNutritionValue,
  parseServings,
  saveBufferImage,
  sumMinutes,
} from "./parser-helpers";

/**
 * A Recipe Keeper export is a zip of one HTML page and a folder of photos.
 * Recipe Keeper publishes no format, so these facts come from a real export
 * and the open-source importers. Every field is read by its `itemprop`,
 * never by its label: the labels are translated ("Portate", "Porzioni") and
 * the itemprops are not.
 */
const RECIPE_KEEPER_HTML = "recipes.html";

/** A photo the page points at: a file in the export's own `images/` folder. */
const PHOTO_PATH = /^images\/[^/\\]+$/;

const MAX_PHOTOS = MAX_RECIPE_IMAGES;

export type RecipeKeeperRecipe = {
  name: string;
  courses: string[];
  categories: string[];
  collections: string[];
  source: string;
  yield: string;
  prepTime: string;
  cookTime: string;
  /** Ingredient lines, a bold one already written as a Heading */
  ingredients: string[];
  directions: string[];
  notes: string[];
  nutrition: { calories: string; fat: string; carbs: string; protein: string };
  /** Photo paths inside the export, in Recipe Keeper's order */
  photos: string[];
  /** 1–5, or undefined when unrated (Recipe Keeper writes 0) */
  rating?: number;
  favorite: boolean;
};

export type ParsedRecipeKeeperRecipe = {
  dto: FullRecipeInsertDTO;
  importedRating?: number;
  importedFavorite?: boolean;
  /** The recipe's collections, filed as the importer's cookbooks */
  cookbooks: string[];
  /** How many photos the gallery had no room for */
  droppedPhotos: number;
};

/** The export's page at the zip root, or null when there is none. */
export async function readRecipeKeeperHtml(zip: JSZip): Promise<string | null> {
  return zip.file(RECIPE_KEEPER_HTML)?.async("string") ?? null;
}

/** Each recipe block on the page: a `div.recipe-details` carrying its `recipeId`. */
function recipeBlocks($: cheerio.CheerioAPI) {
  return $("div.recipe-details").filter(
    (_, block) => $(block).find('[itemprop="recipeId"]').length > 0
  );
}

/** How many recipes the page holds; none means it is not Recipe Keeper's. */
export function countRecipeKeeperRecipes(html: string): number {
  return recipeBlocks(cheerio.load(html)).length;
}

/**
 * Read every recipe block on the page. The markup is not strict HTML
 * (unclosed `<meta>`, unquoted `itemprop=photo0`), which cheerio reads as a
 * browser would.
 */
export function extractRecipeKeeperRecipes(html: string): RecipeKeeperRecipe[] {
  const $ = cheerio.load(html);

  return recipeBlocks($)
    .toArray()
    .map((block) => {
      const $block = $(block);
      const textOf = (selection: { text(): string }) =>
        selection.text().replace(/\s+/g, " ").trim();

      // A field is a `<span>` with its value as text, or a `<meta>` with it
      // as content: the first course is the one and every further one the other.
      const values = (prop: string) =>
        $block
          .find(`[itemprop="${prop}"]`)
          .toArray()
          .map((el) =>
            el.tagName === "meta" ? ($(el).attr("content") ?? "").trim() : textOf($(el))
          )
          .filter((value) => value.length > 0);
      const value = (prop: string) => values(prop)[0] ?? "";
      const rating = parseInt(value("recipeRating"), 10);
      const paragraphs = (prop: string) =>
        $block
          .find(`[itemprop="${prop}"] p`)
          .toArray()
          .map((p) => ({ text: textOf($(p)), bold: textOf($(p).children("b, strong")) }))
          .filter((line) => line.text.length > 0);

      return {
        name: value("name"),
        courses: values("recipeCourse"),
        categories: values("recipeCategory"),
        collections: values("recipeCollection"),
        source: value("recipeSource"),
        yield: value("recipeYield"),
        prepTime: value("prepTime"),
        cookTime: value("cookTime"),
        ingredients: paragraphs("recipeIngredients").map((line) =>
          line.bold === line.text ? `# ${line.text.replace(/:$/, "").trim()}` : line.text
        ),
        directions: paragraphs("recipeDirections")
          .map((line) => line.text.replace(/^\d+\.\s+/, ""))
          .filter((line) => line.length > 0),
        notes: paragraphs("recipeNotes").map((line) => line.text),
        nutrition: {
          calories: value("recipeNutCalories"),
          fat: value("recipeNutTotalFat"),
          carbs: value("recipeNutTotalCarbohydrate"),
          protein: value("recipeNutProtein"),
        },
        photos: $block
          .find('img[itemprop^="photo"]')
          .toArray()
          .map((img) => ({
            order: Number(($(img).attr("itemprop") ?? "").slice("photo".length)),
            src: $(img).attr("src") ?? "",
          }))
          .sort((a, b) => a.order - b.order)
          .map((photo) => photo.src),
        rating: rating >= 1 && rating <= 5 ? rating : undefined,
        favorite: value("recipeIsFavourite") === "True",
      };
    });
}

/** ISO 8601 minutes, with `PT0S` (Recipe Keeper's "no time") as unset. */
function minutesOf(iso: string): number | undefined {
  const minutes = parseIsoDuration(iso);

  return minutes ? minutes : undefined;
}

/** Each name once, matched case-insensitively, as written the first time. */
function distinct<T extends string>(names: T[]): T[] {
  const seen = new Set<string>();

  return names.filter((name) => {
    const key = name.toLowerCase();

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}

export async function parseRecipeKeeperRecipeToDTO(
  recipe: RecipeKeeperRecipe,
  recipeId: string,
  zip: JSZip
): Promise<ParsedRecipeKeeperRecipe> {
  const prepMinutes = minutesOf(recipe.prepTime);
  const cookMinutes = minutesOf(recipe.cookTime);

  const dto = await buildRecipeDTO({
    name: recipe.name,
    // Recipe Keeper also writes plain text here ("Recipe Keeper"), which is
    // no address to go back to.
    url: /^https?:\/\//i.test(recipe.source) ? recipe.source : undefined,
    servings: parseServings(recipe.yield || null),
    prepMinutes,
    cookMinutes,
    totalMinutes: sumMinutes(prepMinutes, cookMinutes),
    ingredientsText: recipe.ingredients.join("\n"),
    instructionsText: recipe.directions.join("\n"),
    categories: distinct([...recipe.courses, ...recipe.categories]),
  });

  const images: Array<{ image: string; order: number }> = [];

  for (const photo of recipe.photos.slice(0, MAX_PHOTOS)) {
    const file = PHOTO_PATH.test(photo) ? zip.file(photo) : null;
    const saved = file ? await saveBufferImage(await file.async("nodebuffer"), recipeId) : null;

    if (saved) images.push({ image: saved, order: images.length });
  }

  const calories = parseNutritionValue(recipe.nutrition.calories);
  const fat = parseNutritionValue(recipe.nutrition.fat);
  const carbs = parseNutritionValue(recipe.nutrition.carbs);
  const protein = parseNutritionValue(recipe.nutrition.protein);

  return {
    dto: {
      ...dto,
      id: recipeId,
      notes: recipe.notes.join("\n") || undefined,
      // A course the matcher recognises is also its meal; a category is a label only.
      categories: distinct(
        recipe.courses.flatMap((course) => {
          const category = matchCategory(course);

          return category ? [category] : [];
        })
      ),
      calories: calories != null ? Math.round(calories) : null,
      fat: fat != null ? fat.toString() : null,
      carbs: carbs != null ? carbs.toString() : null,
      protein: protein != null ? protein.toString() : null,
      image: images[0]?.image,
      images,
    },
    importedRating: recipe.rating,
    importedFavorite: recipe.favorite || undefined,
    cookbooks: recipe.collections,
    droppedPhotos: Math.max(0, recipe.photos.length - MAX_PHOTOS),
  };
}
