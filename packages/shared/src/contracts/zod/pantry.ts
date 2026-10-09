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
    /**
     * The Ingredient's ancestors, nearest first: a Pantry Ingredient covers a
     * recipe line for any of them ("red onion" covers "onion"), never the
     * reverse.
     */
    ancestorIds: z.array(z.string()),
    /** The Ingredient's best spelling per language, for showing it in the viewer's. */
    localeNames: z.record(z.string(), z.string()),
  });

/**
 * Adding to the Pantry: a client-minted id (ADR-0003) and either a name the
 * member typed, which the server resolves, or the food they picked, which it
 * keeps as picked.
 */
export const PantryIngredientAddSchema = z.union([
  z.object({ id: clientMintedId, name: PantryIngredientNameSchema }),
  z.object({ id: clientMintedId, ingredientId: z.uuid() }),
]);

/**
 * A food the household's own recipes use and its Pantry does not cover,
 * offered under "From your recipes": `recipeCount` is how many of those
 * recipes name it, each counted once.
 */
export const PantrySuggestionSchema = z.object({
  ingredientId: z.string(),
  name: z.string(),
  localeNames: z.record(z.string(), z.string()),
  recipeCount: z.number().int().positive(),
});

export const PantryIngredientRemoveSchema = z.object({
  id: z.uuid(),
});
