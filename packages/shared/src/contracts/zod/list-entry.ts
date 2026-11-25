import { z } from "zod";

import { cleanCategoryName } from "../../lib/categories";

/**
 * The name each list kind takes, the bound recipes write it under too (ADR-0043). Reads take any
 * stored name, so one from before a bound stays readable.
 */
export const ListEntryNameSchemas = {
  tag: z.string(),
  cuisine: z.string().trim().min(1).max(80),
  category: z.string().overwrite(cleanCategoryName).min(1).max(40),
} as const;
