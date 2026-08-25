import z from "zod";

import { clientMintedId } from "./common";

/**
 * The Cookbook title: the only thing a cookbook stores beyond its own row
 * metadata. Trimmed, because a title made of spaces is not a title.
 */
export const CookbookTitleSchema = z.string().trim().min(1).max(120);

/**
 * A cookbook as every list and card reads it.
 *
 * `memberCount` and `coverImages` are viewer-scoped: they answer the same
 * view policy the recipe list applies, so two readers can honestly see
 * different counts for the same cookbook and the count always agrees with
 * what is on screen (ADR-0027).
 */
export const CookbookSummarySchema = z.object({
  id: z.uuid(),
  userId: z.string().nullable(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int(),
  memberCount: z.number().int().nonnegative(),
  /** Member images for the derived cover mosaic, resolved gallery-first. */
  coverImages: z.array(z.string()),
});

/** A cookbook offered for filing, with this recipe's membership shown. */
export const EditableCookbookSchema = CookbookSummarySchema.extend({
  containsRecipe: z.boolean(),
});

export const CookbookCreateInputSchema = z.object({
  // Client-minted so that filing queued behind an Offline create still points
  // at the right cookbook once replayed (ADR-0003).
  id: clientMintedId,
  title: CookbookTitleSchema,
});

export const CookbookRenameInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  title: CookbookTitleSchema,
});

export const CookbookDeleteInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});

export const CookbookGetInputSchema = z.object({
  id: z.uuid(),
});

export const CookbookListInputSchema = z.object({
  cursor: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Zero-based pagination offset. Defaults to 0."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of cookbooks to return. Defaults to 50."),
  search: z.string().optional().describe("Optional title search term."),
  sortMode: z
    .enum(["titleAsc", "titleDesc", "dateAsc", "dateDesc", "none"])
    .default("dateDesc")
    .describe("Ordering. Defaults to newest first."),
});

export const CookbookListResultSchema = z.object({
  cookbooks: z.array(CookbookSummarySchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative().nullable(),
});
