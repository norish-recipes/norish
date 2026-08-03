import z from "zod";

/**
 * A Step Ingredient as it travels: a reference from a step to one of the
 * recipe's ingredient lines, carried as a fractional share of that line.
 *
 * The reference names the line by its `order` within the step's own
 * measurement system rather than by row id, because line rows are minted
 * inside the save transaction (a chip on a freshly typed line has no row id
 * to point at) and the public share view exposes no ids at all. Orders are
 * assigned as array indices on every save, so within one payload the key is
 * exact; the stored form is a real foreign key, so deletes cascade.
 *
 * The share defaults to the whole line. Displayed amounts are always derived
 * at render time — share × the line's current amount — never stored.
 */
export const StepIngredientSchema = z.object({
  ingredientOrder: z.coerce.number(),
  share: z.coerce.number().positive().default(1),
  order: z.coerce.number().optional(),
});

export const StepIngredientOutputSchema = z.object({
  ingredientOrder: z.coerce.number(),
  share: z.coerce.number(),
  order: z.coerce.number(),
});
