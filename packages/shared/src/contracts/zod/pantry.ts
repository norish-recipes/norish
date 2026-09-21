import { createSelectSchema } from "drizzle-zod";
import z from "zod";

import { pantryIngredients } from "@norish/db-schema/schema";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

import { clientMintedId } from "./common";

/**
 * A Pantry Ingredient's name: one to a hundred characters, with the whitespace
 * around it gone, and something left once it is folded — "!?" is punctuation,
 * not a name, and would match nothing in a Pantry.
 */
export const PantryIngredientNameSchema = z
  .string()
  .trim()
  .min(1, "Pantry ingredient name is required")
  .max(100)
  .refine((name) => normalizeGroceryName(name) !== "", "Pantry ingredient name is required");

/**
 * A Pantry Ingredient as the household reads it. The row holds only the Ingredient
 * Name it points at; `name` and `normalizedName` are that name and its fold,
 * read with it, so a screen has what it needs without a second round trip.
 */
export const PantryIngredientSelectSchema = createSelectSchema(pantryIngredients)
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    name: z.string(),
    normalizedName: z.string(),
  });

// Adding to the Pantry: a client-minted id (ADR-0003) and a name. The server folds it.
export const PantryIngredientAddSchema = z.object({
  id: clientMintedId,
  name: PantryIngredientNameSchema,
});

export const PantryIngredientRemoveSchema = z.object({
  id: z.uuid(),
});
