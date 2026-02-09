import type { z } from "zod";
import type {
  RecipeDashboardSchema,
  FullRecipeSchema,
  FullRecipeInsertSchema,
  FullRecipeUpdateSchema,
  AuthorSchema,
  measurementSystems,
} from "@/server/db/zodSchemas";

export type MeasurementSystem = (typeof measurementSystems)[number];
export type RecipeCategory = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type RecipeDashboardDTO = z.output<typeof RecipeDashboardSchema>;
export type FullRecipeDTO = z.output<typeof FullRecipeSchema>;
export type AuthorDTO = z.output<typeof AuthorSchema>;
export type FullRecipeInsertDTO = z.input<typeof FullRecipeInsertSchema>;
export type FullRecipeUpdateDTO = z.input<typeof FullRecipeUpdateSchema>;
