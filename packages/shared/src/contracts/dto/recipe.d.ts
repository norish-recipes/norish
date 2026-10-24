import type { z } from "zod";

import type {
  AuthorSchema,
  FullRecipeInsertSchema,
  FullRecipeSchema,
  FullRecipeUpdateSchema,
  measurementSystems,
  RecipeDashboardSchema,
} from "@norish/shared/contracts/zod";

export type MeasurementSystem = (typeof measurementSystems)[number];
export type RecipeCategory = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type RecipeDashboardDTO = z.output<typeof RecipeDashboardSchema>;
export type FullRecipeDTO = z.output<typeof FullRecipeSchema>;
export type AuthorDTO = z.output<typeof AuthorSchema>;
export type FullRecipeInsertDTO = z.input<typeof FullRecipeInsertSchema>;
export type FullRecipeUpdateDTO = z.input<typeof FullRecipeUpdateSchema>;
