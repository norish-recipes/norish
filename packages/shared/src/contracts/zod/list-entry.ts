import { z } from "zod";

import { cleanCategoryName } from "../../lib/categories";

/** The longest name a list creates or renames an entry to, per kind (ADR-0043); none for Tags. */
export const LIST_NAME_MAX = { tag: Infinity, cuisine: 80, category: 40 } as const;

/** A Category name as a recipe write or filter takes it: cleaned, of any stored length. */
export const StoredCategoryNameSchema = z.string().overwrite(cleanCategoryName).min(1);

/** The name each list kind creates or renames an entry to; filters, attaches and reads take any
 * stored name, so one from before a bound stays usable. */
export const ListEntryNameSchemas = {
  tag: z.string(),
  cuisine: z.string().trim().min(1).max(LIST_NAME_MAX.cuisine),
  category: StoredCategoryNameSchema.max(LIST_NAME_MAX.category),
} as const;
