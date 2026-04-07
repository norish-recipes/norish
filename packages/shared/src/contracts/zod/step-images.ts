import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { stepImages } from "@norish/db/schema";

export const StepImageSelectSchema = createSelectSchema(stepImages);
export const StepImageInsertSchema = createInsertSchema(stepImages).omit({
  id: true,
  createdAt: true,
});

export const StepImageOutputSchema = z.object({
  id: z.uuid(),
  image: z.string(),
  order: z.coerce.number().default(0),
  version: z.number(),
});

export const StepImageSchema = z.object({
  id: z.uuid().optional(),
  image: z.string(),
  order: z.coerce.number().default(0),
  version: z.number().int().positive().optional(),
});

export const StepImageInputSchema = z.object({
  image: z.string(),
  order: z.coerce.number().default(0),
});
