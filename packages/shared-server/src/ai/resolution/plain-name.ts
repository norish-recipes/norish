/**
 * A food's Plain Name read by the model (`ingredient-plain-name`) where the Ingredient Words could
 * not ("GR TONIJN UIT BLIK" is "tonijn uit blik"); its other spellings ride along.
 */
import { z } from "zod";

import { generateStructured } from "../runtime/runtime";

/** How many of a food's other spellings the question shows. */
const SHOWN_SPELLINGS = 8;

const plainNameSchema = z
  .object({
    plainName: z
      .string()
      .nullable()
      .describe(
        "The name with everything that is not the food taken off, in its own language; null when it names no food."
      ),
  })
  .strict();

function plainNameSections(name: string, spellings: readonly string[]): string[] {
  const others = spellings.filter((spelling) => spelling !== name).slice(0, SHOWN_SPELLINGS);

  return [`Name: ${name}`, ...(others.length > 0 ? [`Also written as: ${others.join("; ")}`] : [])];
}

/**
 * What the language model reads `name` as, plain, or null where it says the
 * name names no food. Throws whatever the runtime throws.
 */
export async function readPlainName(
  name: string,
  spellings: readonly string[]
): Promise<string | null> {
  const { plainName } = await generateStructured({
    prompt: "ingredient-plain-name",
    schema: plainNameSchema,
    sections: plainNameSections(name, spellings),
  });

  return plainName?.trim() || null;
}
