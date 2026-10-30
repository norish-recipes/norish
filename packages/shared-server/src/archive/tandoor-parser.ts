import JSZip from "jszip";
import { z } from "zod";

import { FullRecipeInsertSchema } from "@norish/db";
import { matchCategory } from "@norish/shared-server/ai/enrichment/category-matcher";
import { saveImageBytes } from "@norish/shared-server/media/storage";
import { FullRecipeInsertDTO } from "@norish/shared/contracts";
import { inferSystemUsedFromParsed } from "@norish/shared/lib/determine-recipe-system";

import { galleryOf, sumMinutes, withLineFoodTexts } from "./parser-helpers";

// Zod schemas for Tandoor recipe structure
const TandoorFoodSchema = z.object({
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  plural_name: z.string().nullable().optional(),
  ignore_shopping: z.boolean().nullish(),
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
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  plural_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const TandoorIngredientSchema = z.object({
  food: TandoorFoodSchema.nullish(),
  unit: TandoorUnitSchema.nullish(),
  amount: z.number().nullish(),
  note: z.string().nullish(),
  order: z.number().nullish(),
  is_header: z.boolean().nullish(),
  no_amount: z.boolean().nullish(),
  always_use_plural_unit: z.boolean().nullish(),
  always_use_plural_food: z.boolean().nullish(),
});

const TandoorStepSchema = z.object({
  name: z.string().nullish(),
  instruction: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  ingredients: z
    .array(TandoorIngredientSchema)
    .nullish()
    .transform((value) => value ?? []),
  time: z.number().nullish(),
  order: z.number().nullish(),
  show_as_header: z.boolean().nullish(),
  show_ingredients_table: z.boolean().nullish(),
});

const TandoorKeywordSchema = z.object({
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  description: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});

export const TandoorRecipeSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  keywords: z
    .array(TandoorKeywordSchema)
    .nullish()
    .transform((value) => value ?? []),
  steps: z
    .array(TandoorStepSchema)
    .nullish()
    .transform((value) => value ?? []),
  working_time: z.number().optional().nullable(),
  waiting_time: z.number().optional().nullable(),
  internal: z.boolean().nullish(),
  nutrition: z.any().nullable().optional(),
  servings: z.number().optional().nullable(),
  servings_text: z.string().nullish(),
  source_url: z.string().optional().nullable(),
});

export type TandoorRecipe = z.infer<typeof TandoorRecipeSchema>;
export type TandoorStep = z.infer<typeof TandoorStepSchema>;
export type TandoorIngredient = z.infer<typeof TandoorIngredientSchema>;

/** No amount when Tandoor says so, or when the amount is 0. */
function amountOf(ingredient: TandoorIngredient): number | null {
  return ingredient.no_amount || !ingredient.amount ? null : ingredient.amount;
}

/**
 * A food's or unit's name as Tandoor shows it: plural when there is an amount
 * other than 1 and it has a plural (Tandoor's template helper rule).
 */
function shownName(
  named: { name: string; plural_name?: string | null } | null | undefined,
  ingredient: TandoorIngredient
): string {
  const name = named?.name?.trim() ?? "";
  const plural = named?.plural_name?.trim();
  const amount = amountOf(ingredient);

  return name && plural && amount !== null && amount !== 1 ? plural : name;
}

type TandoorLine = {
  name: string;
  amount: number | null;
  unit: string | null;
  /** The food the line resolves from, when Tandoor named one */
  foodText?: string;
};

/**
 * One ingredient row as a line. A header row is a Heading named by its note,
 * whatever stale food it still carries; any other row is its food, as Tandoor
 * shows it, followed by its note, or its note alone when it names no food.
 */
function readTandoorLine(ingredient: TandoorIngredient): TandoorLine | null {
  const note = ingredient.note?.trim();

  if (ingredient.is_header) {
    return note ? { name: `# ${note}`, amount: null, unit: null } : null;
  }

  const food = shownName(ingredient.food, ingredient);
  const name = [food, note].filter(Boolean).join(", ");

  if (!name) return null;

  const amount = amountOf(ingredient);

  return {
    name,
    amount,
    unit: amount === null ? null : ingredient.unit?.name?.trim() || null,
    foodText: ingredient.food?.name?.trim() || undefined,
  };
}

type TemplateField = "amount" | "unit" | "food" | "note";

/** "amount unit food", as Tandoor writes `{{ ingredients[i] }}` into a step. */
function templateText(
  ingredient: TandoorIngredient | undefined,
  field: TemplateField | undefined
): string {
  if (!ingredient) return "";

  const amount = amountOf(ingredient);
  const parts = {
    amount: amount === null ? "" : String(amount),
    unit: shownName(ingredient.unit, ingredient),
    food: ingredient.is_header ? "" : shownName(ingredient.food, ingredient),
    note: ingredient.note?.trim() ?? "",
  };

  if (field) return parts[field];

  return [parts.amount, parts.unit, parts.food].filter(Boolean).join(" ");
}

/**
 * Show templated step text as a Tandoor reader sees it: `{{ ingredients[i] }}`
 * (indexed within the step, header rows included) and its `.amount`, `.unit`,
 * `.food` and `.note` become text, `{{ scale(n) }}` becomes the number, and
 * any leftover braces are stripped, as Tandoor strips them.
 */
function renderTandoorTemplate(instruction: string, ingredients: TandoorIngredient[]): string {
  return instruction
    .replace(
      /\{\{\s*ingredients\[(\d+)\](?:\.(amount|unit|food|note))?\s*\}\}/g,
      (_, index: string, field?: TemplateField) => templateText(ingredients[Number(index)], field)
    )
    .replace(/\{\{\s*scale\(\s*([\d.]+)\s*\)\s*\}\}/g, "$1")
    .replace(/[{}]/g, "");
}

/**
 * Parse a Tandoor recipe JSON and map to FullRecipeInsertDTO
 */
export async function parseTandoorRecipeToDTO(
  json: TandoorRecipe,
  recipeId: string,
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
      image = await saveImageBytes(imageBuffer, recipeId);
    } catch {
      // Ignore image failure, proceed without image
    }
  }

  // Flatten all ingredients from all steps into a single list. Tandoor nests
  // ingredients inside the step that uses them; Norish keeps one flat list of
  // ingredient lines and records the step -> line relation as Step Ingredients,
  // which reference a line by its `order`. So remember, per Tandoor step, the
  // order of every line it contributed. Keyed by step object (not index) so the
  // relation survives the filtering of steps further down. Steps are walked
  // in the order they are shown, so the lines read in that order too.
  const sortedSteps = [...(validated.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const allIngredients: Array<TandoorLine & { globalOrder: number }> = [];
  const lineOrdersByStep = new Map<TandoorStep, number[]>();
  let globalOrder = 0;

  for (const step of sortedSteps) {
    const lineOrders: number[] = [];

    for (const ingredient of step.ingredients || []) {
      const line = readTandoorLine(ingredient);

      if (!line) continue;

      // A header row is a line among the others, but never a step's ingredient.
      if (!ingredient.is_header) lineOrders.push(globalOrder);
      allIngredients.push({ ...line, globalOrder: globalOrder++ });
    }

    lineOrdersByStep.set(step, lineOrders);
  }

  const ingredientsForDetection = allIngredients.map((ing) => ({
    quantity: ing.amount?.toString() || "",
    quantity2: null,
    unitOfMeasure: ing.unit || "",
    unitOfMeasureID: ing.unit || "",
    description: ing.name,
    isGroupHeader: false,
  })) as any;

  const systemUsed = inferSystemUsedFromParsed(ingredientsForDetection);

  // Map ingredients to our schema
  const recipeIngredients = allIngredients.map((ing) => ({
    ingredientId: null,
    ingredientName: ing.name,
    amount: ing.amount,
    unit: ing.unit,
    systemUsed: systemUsed,
    order: ing.globalOrder,
  }));

  const formatStepText = (step: TandoorStep): string => {
    const instruction = renderTandoorTemplate(step.instruction, step.ingredients).trim();
    const stepNote = step.name?.trim();

    if (!stepNote) return instruction;

    return `**${stepNote}** ${instruction}`;
  };

  const steps = sortedSteps
    .filter((step) => step.instruction && step.instruction.trim())
    .map((step, index) => ({
      step: formatStepText(step),
      order: index,
      systemUsed: systemUsed,
      // Tandoor lists the whole amount of an ingredient under the step that
      // uses it, so every link carries the full line (share 1).
      stepIngredients: (lineOrdersByStep.get(step) ?? []).map((ingredientOrder, linkOrder) => ({
        ingredientOrder,
        share: 1,
        order: linkOrder,
      })),
    }));

  // Extract tags from keywords
  const tags = (validated.keywords || [])
    .filter((kw) => kw.name && kw.name.trim())
    .map((kw) => ({ name: kw.name.trim() }));

  const categoryCandidates = tags.flatMap((tag) =>
    tag.name
      .split(/[,&/;|]/g)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );

  const categories = Array.from(
    new Set(
      categoryCandidates
        .map((value) => matchCategory(value))
        .filter((category): category is "Breakfast" | "Lunch" | "Dinner" | "Snack" =>
          Boolean(category)
        )
    )
  );

  // Calculate total time
  const parseTime = (val: number | null | undefined): number | undefined => {
    if (val === null || val === undefined) return undefined;

    return Number.isFinite(val) && val > 0 ? val : undefined;
  };

  // Working time is prep and waiting is neither prep nor cook, so cook stays
  // empty and the wait shows as Other Time within the total.
  const prepMinutes = parseTime(validated.working_time);
  const waitingMinutes = parseTime(validated.waiting_time);
  const totalMinutes = sumMinutes(prepMinutes, waitingMinutes);

  // Build DTO
  const dto: FullRecipeInsertDTO = {
    id: recipeId,
    name: name,
    url: validated.source_url || undefined,
    images: galleryOf(image),
    description: validated.description || undefined,
    servings: validated.servings || undefined,
    systemUsed: systemUsed,
    prepMinutes: prepMinutes,
    totalMinutes: totalMinutes,
    recipeIngredients: recipeIngredients,
    steps: steps,
    tags: tags,
    categories: categories,
  };

  // Validate against our schema
  const parsed = FullRecipeInsertSchema.safeParse(dto);

  if (!parsed.success) {
    throw new Error(`Schema validation failed: ${parsed.error.message}`);
  }

  return withLineFoodTexts(
    parsed.data,
    allIngredients.map((line) => line.foodText)
  );
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
      const firstImageFile = imageFiles[0];

      if (firstImageFile) {
        const imageArrayBuffer = await firstImageFile.async("arraybuffer");

        imageBuffer = Buffer.from(imageArrayBuffer);
      }

      results.push({
        recipe,
        image: imageBuffer,
        fileName: zipFile.name,
      });
    } catch (e: any) {
      throw new Error(`Failed to parse ${zipFile.name}: ${e?.message || e}`, { cause: e });
    }
  }

  return results;
}
