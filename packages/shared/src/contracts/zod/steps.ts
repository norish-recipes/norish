import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod";

import { steps } from "@norish/db/schema";

import { StepImageOutputSchema, StepImageSchema } from "./step-images";

export const StepSelectBaseSchema = createSelectSchema(steps);
export const StepInsertBaseSchema = createInsertSchema(steps)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    order: z.coerce.number(),
  });
export const StepUpdateBaseSchema = createUpdateSchema(steps);

export const StepStepSchema = StepSelectBaseSchema.pick({
  step: true,
  order: true,
  systemUsed: true,
}).extend({
  order: z.coerce.number(),
  version: z.number().int().positive().optional(),
  images: z.array(StepImageSchema).optional().default([]),
});

export const StepOutputSchema = z.object({
  step: z.string(),
  systemUsed: StepSelectBaseSchema.shape.systemUsed,
  order: z.coerce.number(),
  version: z.number(),
  images: z.array(StepImageOutputSchema).optional().default([]),
});

export const StepSelectWithoutId = StepSelectBaseSchema.omit({
  id: true,
  recipeId: true,
  updatedAt: true,
  createdAt: true,
}).extend({
  order: z.coerce.number(),
});
