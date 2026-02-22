import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod";

import { StepImageSchema } from "./step-images";

import { steps } from "@/server/db/schema";

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
  images: z.array(StepImageSchema).optional().default([]),
});

export const StepSelectWithoutId = StepSelectBaseSchema.omit({
  id: true,
  recipeId: true,
  updatedAt: true,
  createdAt: true,
}).extend({
  order: z.coerce.number(),
});
