import { z } from "zod";

import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

export const recipeAutocompleteInputSchema = z.object({
  query: z.string().min(1).max(100),
});

export const randomRecipeInputSchema = z.object({
  category: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]).optional(),
});

export const recipeImportPasteInputSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe(
      [
        "Pasted recipe text.",
        "Supports plain text, JSON-LD recipe objects/arrays/@graph payloads, and YAML recipe mappings/arrays.",
        `Each recipe is limited to ${MAX_RECIPE_PASTE_CHARS.toLocaleString()} characters.`,
        "When forcing AI only one recipe will be parsed.",
        'JSON-LD single example: {"@type":"Recipe","name":"Toast","recipeIngredient":["2 slices bread"],"recipeInstructions":["Toast bread"]}',
        'JSON-LD multi example: [{"@type":"Recipe",...},{"@type":"Recipe",...}]',
        "YAML single example: title: Toast\\ningredients:\\n  - 2 slices bread\\nsteps:\\n  - Toast bread",
        "YAML multi example: - title: Toast\\n  ingredients:\\n    - 2 slices bread\\n  steps:\\n    - Toast bread",
      ].join(" ")
    ),
  forceAI: z.boolean().optional(),
});

export const recipeImportPasteOutputSchema = z.object({
  recipeIds: z
    .array(z.uuid())
    .describe(
      "Created recipe IDs in source order. Single imports still return one ID in this array."
    ),
});

export const recipeIdInputSchema = z.object({ recipeId: z.uuid() });
