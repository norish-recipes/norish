import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { tags } from "@norish/db/schema";

export const TagSelectBaseSchema = createSelectSchema(tags);
export const TagInsertBaseSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});
export const TagUpdateBaseSchema = createUpdateSchema(tags);

export const TagSummarySchema = z.object({
  name: z.string(),
  version: z.number(),
});
export const TagNameSchema = TagSelectBaseSchema.pick({ name: true });
