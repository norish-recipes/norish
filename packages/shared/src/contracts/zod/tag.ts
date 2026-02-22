import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";

import { tags } from "@/server/db/schema";

export const TagSelectBaseSchema = createSelectSchema(tags);
export const TagInsertBaseSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});
export const TagUpdateBaseSchema = createUpdateSchema(tags);

export const TagNameSchema = TagSelectBaseSchema.pick({ name: true });
