/**
 * The Plain Name of a food's name, read by the language model where the
 * Ingredient Words could not (CONTEXT.md): "GR TONIJN UIT BLIK" is "tonijn
 * uit blik". Its input is a name and its output a name, under the
 * administrator-editable `ingredient-plain-name` Prompt. The food's other
 * spellings ride along, since the words rung 2 took off a name ("@blueband_nl")
 * may be what says whose product it is.
 */
import { z } from "zod";

import type { ModelTokenEstimate } from "@norish/shared/contracts/ingredient-catalogue";

import { estimateStructuredInputTokens, generateStructured } from "../runtime/runtime";

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

/** What the answer to one question takes on top of what is sent: a name in a small JSON object. */
const ANSWER_TOKENS = 20;

/**
 * About how many tokens one food's question takes, counted from what would
 * be sent for these names rather than by asking, on average.
 */
export async function estimatePlainNameTokens(
  names: readonly string[]
): Promise<ModelTokenEstimate[]> {
  if (names.length === 0) return [];
  const estimates = await Promise.all(
    names.map((name) =>
      estimateStructuredInputTokens({
        prompt: "ingredient-plain-name",
        schema: plainNameSchema,
        sections: plainNameSections(name, []),
      })
    )
  );
  const { provider, model } = estimates[0]!;
  const tokens = estimates.reduce((sum, estimate) => sum + estimate.tokens + ANSWER_TOKENS, 0);

  return [{ provider, model, perFood: Math.round(tokens / names.length) }];
}
