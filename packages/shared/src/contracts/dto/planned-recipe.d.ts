import type z from "zod";

import type {
  PlannedRecipeCreateSchema,
  PlannedRecipeDeleteSchema,
  PlannedRecipeInsertBaseSchema,
  PlannedRecipeListSchema,
  PlannedRecipeSelectBaseSchema,
  PlannedRecipeUpdateBaseSchema,
  PlannedRecipeUpdateDateSchema,
  plannedRecipeViewSchema,
  slots,
} from "@norish/shared/contracts/zod";

import type { NoteViewDto } from "./notes";

export type Slot = (typeof slots)[number];
export type PlannedRecipeDto = z.output<typeof PlannedRecipeSelectBaseSchema>;
export type PlannedRecipeViewDto = z.output<typeof plannedRecipeViewSchema>;

export type PlannedRecipeInsertDto = z.input<typeof PlannedRecipeInsertBaseSchema>;
export type PlannedRecipeUpdateDto = z.input<typeof PlannedRecipeUpdateBaseSchema>;

// tRPC input types
export type PlannedRecipeListInput = z.infer<typeof PlannedRecipeListSchema>;
export type PlannedRecipeCreateInput = z.infer<typeof PlannedRecipeCreateSchema>;
export type PlannedRecipeDeleteInput = z.infer<typeof PlannedRecipeDeleteSchema>;
export type PlannedRecipeUpdateDateInput = z.infer<typeof PlannedRecipeUpdateDateSchema>;

export type CalendarItemViewDto =
  | (PlannedRecipeViewDto & { itemType: "recipe" })
  | (NoteViewDto & { itemType: "note" });
