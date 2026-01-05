import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";

import { ingredients } from "@/server/db/schema";

export const IngredientSelectBaseSchema = createSelectSchema(ingredients);
export const IngredientInsertBaseSchema = createInsertSchema(ingredients).omit({
  id: true,
  createdAt: true,
});
export const IngredientUpdateBaseSchema = createUpdateSchema(ingredients);
export const IngredientNameSchema = IngredientSelectBaseSchema.pick({ name: true });
