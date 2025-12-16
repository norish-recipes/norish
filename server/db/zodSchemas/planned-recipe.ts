import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod";

import { plannedRecipes, slotTypeEnum } from "@/server/db/schema";

export const PlannedRecipeSelectBaseSchema = createSelectSchema(plannedRecipes);

export const plannedRecipeViewSchema = createSelectSchema(plannedRecipes)
  .omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    recipeName: z.string().nullable(),
    allergyWarnings: z.array(z.string()).optional(),
  });

export const PlannedRecipeInsertBaseSchema = createInsertSchema(plannedRecipes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const PlannedRecipeUpdateBaseSchema = createUpdateSchema(plannedRecipes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const slots = slotTypeEnum.enumValues;

// Derived schemas for tRPC routers
export const PlannedRecipeListSchema = z.object({
  startISO: PlannedRecipeSelectBaseSchema.shape.date,
  endISO: PlannedRecipeSelectBaseSchema.shape.date,
});

export const PlannedRecipeCreateSchema = PlannedRecipeInsertBaseSchema.pick({
  date: true,
  slot: true,
  recipeId: true,
});

export const PlannedRecipeDeleteSchema = PlannedRecipeSelectBaseSchema.pick({
  id: true,
  date: true,
});

export const PlannedRecipeUpdateDateSchema = PlannedRecipeSelectBaseSchema.pick({
  id: true,
}).extend({
  newDate: PlannedRecipeSelectBaseSchema.shape.date,
  oldDate: PlannedRecipeSelectBaseSchema.shape.date,
});
