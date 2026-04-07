import type { z } from "zod";

import type {
  NoteCreateSchema,
  NoteDeleteSchema,
  NoteInsertBaseSchema,
  NoteListSchema,
  NoteSelectBaseSchema,
  NoteUpdateBaseSchema,
  NoteUpdateDateSchema,
  noteViewSchema,
} from "@norish/shared/contracts/zod";

export type NoteDto = z.output<typeof NoteSelectBaseSchema>;
export type NoteViewDto = z.output<typeof noteViewSchema>;
export type NoteInsertDto = z.input<typeof NoteInsertBaseSchema>;
export type NoteUpdateDto = z.input<typeof NoteUpdateBaseSchema>;

// tRPC input types
export type NoteListInput = z.infer<typeof NoteListSchema>;
export type NoteCreateInput = z.infer<typeof NoteCreateSchema>;
export type NoteDeleteInput = z.infer<typeof NoteDeleteSchema>;
export type NoteUpdateDateInput = z.infer<typeof NoteUpdateDateSchema>;
