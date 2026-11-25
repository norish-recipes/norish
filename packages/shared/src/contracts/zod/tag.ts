import { z } from "zod";

import { ListEntryNameSchemas } from "./list-entry";

export const TagSummarySchema = z.object({
  name: z.string(),
  version: z.number(),
});
export const TagNameSchema = z.object({ name: ListEntryNameSchemas.tag });
