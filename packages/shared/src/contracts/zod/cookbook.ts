import z from "zod";

import { clientMintedId } from "./common";
import { RecipeDashboardSchema, RecipeListInputSchema } from "./recipe";

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

export const CookbookCreateInputSchema = z.object({
  // Client-minted so that filing queued behind an Offline create still points
  // at the right cookbook once replayed (ADR-0003).
  id: clientMintedId,
  title: CookbookTitleSchema,
  /**
   * File this recipe into the new cookbook in one step, so "these two belong
   * together" is one decision rather than two. Needs view rights on the
   * recipe and nothing more (ADR-0027).
   */
  recipeId: z.uuid().optional(),
});

export const CookbookMembershipInputSchema = z.object({
  cookbookId: z.uuid(),
  recipeId: z.uuid(),
  /** Where the toggle has been left: in the cookbook, or out of it. */
  isMember: z.boolean(),
});

export const CookbookForRecipeInputSchema = z.object({
  recipeId: z.uuid(),
});

/**
 * A cookbook's members, read through the recipe list's own input so the page
 * honours the reader's sort, search and filters without inventing anything.
 */
export const CookbookRecipesInputSchema = RecipeListInputSchema.extend({
  cookbookId: z.uuid(),
  favoritesOnly: z
    .boolean()
    .default(false)
    .describe("Restrict to the caller's favourites, as the Library's own list does."),
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

/**
 * One Library row: a recipe or a cookbook, discriminated by kind.
 *
 * The Library is one list rather than two bands (ADR-0026), so its rows are a
 * discriminated union and every reader of them has to say which kind it is
 * drawing.
 */
export const LibraryItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("recipe"), recipe: RecipeDashboardSchema }),
  z.object({ kind: z.literal("cookbook"), cookbook: CookbookSummarySchema }),
]);

export const LibraryListInputSchema = RecipeListInputSchema.extend({
  /**
   * Which kind of thing to return. A parameter of the query rather than a
   * slice of an already-fetched page, so paging stays correct.
   */
  type: z
    .enum(["all", "recipes", "cookbooks"])
    .default("all")
    .describe("Which kind of Library row to return. Defaults to both."),
  favoritesOnly: z
    .boolean()
    .default(false)
    .describe("Restrict to the caller's favourites. Recipes only."),
});

export const LibraryListResultSchema = z.object({
  items: z.array(LibraryItemSchema),
  /** Counts both kinds. Nothing may read this as a recipe count. */
  total: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative().nullable(),
});
