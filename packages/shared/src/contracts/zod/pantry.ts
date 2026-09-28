import { createSelectSchema } from "drizzle-zod";
import z from "zod";

import { pantryIngredients } from "@norish/db-schema/schema";
import { foldName } from "@norish/shared/lib/fold-name";

import { clientMintedId } from "./common";

/** A Pantry Ingredient name is at most this long; the field that takes one stops there too. */
export const PANTRY_INGREDIENT_NAME_MAX_LENGTH = 100;

/**
 * A Pantry Ingredient's name: one to a hundred characters, with the whitespace
 * around it gone, and something left once it is folded — "!?" is punctuation,
 * not a name, and would match nothing in a Pantry.
 */
export const PantryIngredientNameSchema = z
  .string()
  .trim()
  .min(1, "Pantry ingredient name is required")
  .max(PANTRY_INGREDIENT_NAME_MAX_LENGTH)
  .refine((name) => foldName(name) !== "", "Pantry ingredient name is required");

/**
 * A Pantry Ingredient as the household reads it. The row holds only the
 * Ingredient it points at, through the alias the typed text resolved to;
 * `name` is the Ingredient's name, read with it, so a screen has what it
 * needs without a second round trip. The
 * alias stays on the server: "in the pantry" is a question about the
 * Ingredient.
 */
export const PantryIngredientSelectSchema = createSelectSchema(pantryIngredients)
  .omit({ createdAt: true, updatedAt: true, ingredientAliasId: true })
  .extend({
    name: z.string(),
  });

// Adding to the Pantry: a client-minted id (ADR-0003) and a name. The server folds it.
export const PantryIngredientAddSchema = z.object({
  id: clientMintedId,
  name: PantryIngredientNameSchema,
});

export const PantryIngredientRemoveSchema = z.object({
  id: z.uuid(),
});
