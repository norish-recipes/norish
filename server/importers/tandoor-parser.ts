import JSZip from "jszip";
import { z } from "zod";

import { inferSystemUsedFromParsed } from "@/lib/determine-recipe-system";
import { saveImageBytes } from "@/server/downloader";
import { FullRecipeInsertDTO } from "@/types";
import { FullRecipeInsertSchema } from "@/server/db";

// Zod schemas for Tandoor recipe structure
const TandoorFoodSchema = z.object({
  name: z.string(),
  plural_name: z.string().nullable().optional(),
  ignore_shopping: z.boolean().optional(),
  // Tandoor exports may use either a string or an object for supermarket_category
  supermarket_category: z
    .union([
      z.string(),
      z
        .object({
          name: z.string().optional(),
        })
        .loose(),
      z.null(),
    ])
    .nullable()
    .optional()
    .transform((value) => {
      if (!value) return null;
      if (typeof value === "string") return value;

      return (value as any).name ?? JSON.stringify(value);
    }),
});

const TandoorUnitSchema = z.object({
  name: z.string(),
  plural_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const TandoorIngredientSchema = z.object({
  food: TandoorFoodSchema,
  unit: TandoorUnitSchema.nullable(),
  amount: z.number().nullable(),
  note: z.string().optional(),
  order: z.number().optional(),
  is_header: z.boolean().optional(),
  no_amount: z.boolean().optional(),
  always_use_plural_unit: z.boolean().optional(),
  always_use_plural_food: z.boolean().optional(),
});

const TandoorStepSchema = z.object({
  name: z.string().optional(),
  instruction: z.string(),
  ingredients: z.array(TandoorIngredientSchema).optional().default([]),
  time: z.number().optional(),
  order: z.number().optional(),
  show_as_header: z.boolean().optional(),
  show_ingredients_table: z.boolean().optional(),
});

const TandoorKeywordSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const TandoorRecipeSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  keywords: z.array(TandoorKeywordSchema).optional().default([]),
  steps: z.array(TandoorStepSchema).optional().default([]),
  working_time: z.number().optional().nullable(),
  waiting_time: z.number().optional().nullable(),
  internal: z.boolean().optional(),
  nutrition: z.any().nullable().optional(),
  servings: z.number().optional().nullable(),
  servings_text: z.string().optional(),
  source_url: z.string().optional().nullable(),
});

export type TandoorRecipe = z.infer<typeof TandoorRecipeSchema>;
export type TandoorStep = z.infer<typeof TandoorStepSchema>;
export type TandoorIngredient = z.infer<typeof TandoorIngredientSchema>;

/**
 * Parse a Tandoor recipe JSON and map to FullRecipeInsertDTO
 */
export async function parseTandoorRecipeToDTO(
  json: TandoorRecipe,
  imageBuffer?: Buffer
): Promise<FullRecipeInsertDTO> {
  // Validate against schema
  const validated = TandoorRecipeSchema.parse(json);

  const name = validated.name.trim();

  if (!name) {
    throw new Error("Missing recipe name");
  }

  // Save image if present
  let image: string | undefined = undefined;

  if (imageBuffer) {
    try {
      image = await saveImageBytes(imageBuffer, name);
    } catch {
      // Ignore image failure, proceed without image
    }
  }

  // Flatten all ingredients from all steps into a single list
  const allIngredients: Array<TandoorIngredient & { globalOrder: number }> = [];
  let globalOrder = 0;

  for (const step of validated.steps || []) {
    for (const ingredient of step.ingredients || []) {
      // Skip header ingredients (they're just visual separators)
      if (ingredient.is_header) continue;

      allIngredients.push({
        ...ingredient,
        globalOrder: globalOrder++,
      });
    }
  }

  const ingredientsForDetection = allIngredients.map((ing) => ({
    quantity: ing.amount?.toString() || "",
    quantity2: null,
    unitOfMeasure: ing.unit?.name || "",
    unitOfMeasureID: ing.unit?.name || "",
    description: ing.food.name,
    isGroupHeader: false,
  })) as any;

  const systemUsed = inferSystemUsedFromParsed(ingredientsForDetection);

  // Map ingredients to our schema
  const recipeIngredients = allIngredients.map((ing) => ({
    ingredientId: null,
    ingredientName: ing.food.name,
    amount: ing.amount,
    unit: ing.unit?.name || null,
    systemUsed: systemUsed,
    order: ing.globalOrder,
  }));

  const steps = (validated.steps || [])
    .filter((step) => step.instruction && step.instruction.trim())
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((step, index) => ({
      step: step.instruction.trim(),
      order: index,
      systemUsed: systemUsed,
    }));

  // Extract tags from keywords
  const tags = (validated.keywords || [])
    .filter((kw) => kw.name && kw.name.trim())
    .map((kw) => ({ name: kw.name.trim() }));

  // Calculate total time
  const parseTime = (val: number | null | undefined): number | undefined => {
    if (val === null || val === undefined) return undefined;

    return Number.isFinite(val) && val > 0 ? val : undefined;
  };

  const prepMinutes = parseTime(validated.working_time);
  const cookMinutes = parseTime(validated.waiting_time);
  const totalMinutes =
    prepMinutes !== undefined || cookMinutes !== undefined
      ? (prepMinutes || 0) + (cookMinutes || 0)
      : undefined;

  // Build DTO
  const dto: FullRecipeInsertDTO = {
    name: name,
    url: validated.source_url || undefined,
    image: image || undefined,
    description: validated.description || undefined,
    servings: validated.servings || undefined,
    systemUsed: systemUsed,
    prepMinutes: prepMinutes,
    cookMinutes: cookMinutes,
    totalMinutes: totalMinutes,
    recipeIngredients: recipeIngredients,
    steps: steps,
    tags: tags,
  } as FullRecipeInsertDTO;

  // Validate against our schema
  const parsed = FullRecipeInsertSchema.safeParse(dto);

  if (!parsed.success) {
    throw new Error(`Schema validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}

/**
 * Extract all Tandoor recipes from a zip archive
 * Tandoor exports contain nested zip files, each with a recipe.json and optional image.*
 */
export async function extractTandoorRecipes(
  zip: JSZip
): Promise<Array<{ recipe: TandoorRecipe; image?: Buffer; fileName: string }>> {
  const results: Array<{ recipe: TandoorRecipe; image?: Buffer; fileName: string }> = [];

  // Find all nested .zip files in the root
  const nestedZipFiles = zip.file(/\.zip$/i);

  for (const zipFile of nestedZipFiles) {
    try {
      // Load the nested zip
      const nestedZipBuffer = await zipFile.async("arraybuffer");
      const nestedZip = await JSZip.loadAsync(nestedZipBuffer);

      // Find recipe.json in the nested zip
      const recipeFile = nestedZip.file("recipe.json");

      if (!recipeFile) {
        throw new Error("No recipe.json found in nested zip");
      }

      // Parse recipe.json
      const recipeText = await recipeFile.async("string");
      const recipeJson = JSON.parse(recipeText);

      // Validate against schema
      const recipe = TandoorRecipeSchema.parse(recipeJson);

      // Find image.* file (first match)
      const imageFiles = nestedZip.file(/^image\./i);
      let imageBuffer: Buffer | undefined = undefined;

      if (imageFiles.length > 0) {
        const imageArrayBuffer = await imageFiles[0].async("arraybuffer");

        imageBuffer = Buffer.from(imageArrayBuffer);
      }

      results.push({
        recipe,
        image: imageBuffer,
        fileName: zipFile.name,
      });
    } catch (e: any) {
      throw new Error(`Failed to parse ${zipFile.name}: ${e?.message || e}`);
    }
  }

  return results;
}
