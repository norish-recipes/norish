/**
 * AI's check of the spellings added to a seeded food (ADR-0037; ingredient-cleanup ticket 46): one
 * request lists them and says, per spelling, whether it names the food, no food, or another food.
 */
import { z } from "zod";

import { aiLogger } from "@norish/shared-server/logger";

import { generateStructured } from "../runtime/runtime";
import { onceMoreOnTimeout } from "../runtime/timeout-retry";
import { REQUEST_BUDGET_MS } from "./ingredient-resolution";

/** What a spelling names: its food, no food, or another food (by AI's name, null where AI can't tell). */
export type SpellingVerdict =
  { kind: "this-food" } | { kind: "not-a-food" } | { kind: "other-food"; otherFood: string | null };

/** One flat object, as OpenAI's strict mode needs. */
const verdictsSchema = z
  .object({
    spellings: z.array(
      z
        .object({
          number: z.number().int().describe("The number of the listed spelling."),
          kind: z.enum(["this-food", "not-a-food", "other-food"]),
          otherFood: z
            .string()
            .nullable()
            .describe("For other-food: the food it names, in plain English; null otherwise."),
        })
        .strict()
    ),
  })
  .strict();

/**
 * What each of `spellings` names, in order, each shown with a recipe line using it; one the answer
 * leaves out names the food. Throws where the request fails, a timeout retried once.
 */
export async function askWhatSpellingsName(
  food: { name: string; parent: string | null },
  spellings: ReadonlyArray<{ text: string; line: string | null }>
): Promise<SpellingVerdict[]> {
  const answer = await onceMoreOnTimeout("ingredient-spelling-check")(() =>
    generateStructured({
      prompt: "ingredient-spelling-check",
      schema: verdictsSchema,
      timeoutMs: REQUEST_BUDGET_MS,
      sections: [
        `Name: ${food.name}`,
        ...(food.parent ? [`Parent: ${food.parent}`] : []),
        [
          "Spellings:",
          ...spellings.flatMap(({ text, line }, index) => [
            `${index + 1}. ${text}`,
            ...(line ? [`   Line: ${line}`] : []),
          ]),
        ].join("\n"),
      ],
    })
  );

  aiLogger.info({ food: food.name, ...answer }, "Language model checked a food's spellings");

  return spellings.map((_text, index) => {
    const verdict = answer.spellings.find((one) => one.number === index + 1);

    if (!verdict || verdict.kind === "this-food") return { kind: "this-food" };
    if (verdict.kind === "not-a-food") return { kind: "not-a-food" };

    return { kind: "other-food", otherFood: verdict.otherFood?.trim() || null };
  });
}
