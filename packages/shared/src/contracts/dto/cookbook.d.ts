import type { z } from "zod";

import type {
  CookbookCreateInputSchema,
  CookbookDeleteInputSchema,
  CookbookListInputSchema,
  CookbookListResultSchema,
  CookbookMembershipInputSchema,
  CookbookRenameInputSchema,
  CookbookSummarySchema,
  EditableCookbookSchema,
  LibraryItemSchema,
  LibraryListInputSchema,
  LibraryListResultSchema,
} from "@norish/shared/contracts/zod";

export type CookbookSummaryDTO = z.output<typeof CookbookSummarySchema>;
export type EditableCookbookDTO = z.output<typeof EditableCookbookSchema>;
export type CookbookCreateInput = z.infer<typeof CookbookCreateInputSchema>;
export type CookbookRenameInput = z.infer<typeof CookbookRenameInputSchema>;
export type CookbookDeleteInput = z.infer<typeof CookbookDeleteInputSchema>;
export type CookbookListInput = z.input<typeof CookbookListInputSchema>;
export type CookbookListResult = z.output<typeof CookbookListResultSchema>;
export type CookbookMembershipInput = z.infer<typeof CookbookMembershipInputSchema>;
export type LibraryItemDTO = z.output<typeof LibraryItemSchema>;
export type LibraryListInput = z.input<typeof LibraryListInputSchema>;
export type LibraryListResult = z.output<typeof LibraryListResultSchema>;
