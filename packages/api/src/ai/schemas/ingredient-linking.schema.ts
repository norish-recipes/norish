import { z } from "zod";

/**
 * Step Ingredient links as the model returns them.
 *
 * Steps and ingredient lines are referred to strictly by the numbers the
 * prompt printed beside them, so the inferrer can map the claim back onto
 * rows without the model ever seeing an id.
 */
export const ingredientLinkingSchema = z
  .object({
    links: z
      .array(
        z
          .object({
            step: z.number().int().describe("The step's number exactly as shown in STEPS."),
            ingredients: z
              .array(
                z
                  .object({
                    line: z
                      .number()
                      .int()
                      .describe("The ingredient line's number exactly as shown in INGREDIENTS."),
                    share: z
                      .number()
                      .positive()
                      .max(1)
                      .describe(
                        "Fraction of the line this step uses. 1 is the whole line; half the water is 0.5."
                      ),
                  })
                  .strict()
              )
              .describe("Every ingredient line this step uses."),
          })
          .strict()
      )
      .describe(
        "One entry per step that clearly uses ingredient lines. Steps that use nothing are omitted."
      ),
  })
  .strict();

export type ProposedIngredientLinks = z.infer<typeof ingredientLinkingSchema>;
