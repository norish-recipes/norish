import { z } from "zod";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

export const recipeAutocompleteInputSchema = z.object({
  query: z.string().min(1).max(100),
});

export const randomRecipeInputSchema = z.object({
  category: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]).optional(),
});

export const recipeImportPasteInputSchema = z.object({
  text: z.string().min(1).max(MAX_RECIPE_PASTE_CHARS),
  forceAI: z.boolean().optional(),
});

export const recipeIdInputSchema = z.object({ recipeId: z.uuid() });
