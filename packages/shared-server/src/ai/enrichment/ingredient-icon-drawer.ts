import { setTimeout as sleep } from "node:timers/promises";

import type { ImageTier } from "../runtime/providers";
import type { DecisionBooleanQuestion, GeneratedImageBytes } from "../runtime/runtime";
import { rateLimitWaitMs } from "../runtime/errors";
import { decide, generateImage } from "../runtime/runtime";
import { chunk, MAX_QUESTIONS_PER_DECISION } from "./verification";

/** A food as an icon is drawn of it: its name and what it is a kind of, English where known. */
export interface FoodToDraw {
  name: string;
  /** Its Parent Ingredients, nearest first: pepper is a kind of spice. */
  kindOf: readonly string[];
}

/**
 * What every icon is asked to be, whatever style the administrator's prompt
 * sets: the cut-out that makes a picture an icon depends on one food on a
 * flat background, so this is the code's to say, never the prompt's.
 */
const COMPOSITION = [
  "Show exactly one food, whole or as one natural portion, centred and filling most of the square.",
  "Nothing stands behind it: no tile, card, badge, rounded square or frame.",
  "Where the background cannot be transparent, make it plain, flat, evenly lit and of one solid colour that the food itself does not contain.",
  "No shadow beneath it, no reflection, and no plate, board, cutlery, garnish or other props.",
  "A food with no shape of its own sits in the plainest vessel that holds it: milk in a glass, oil in a bottle, flour in a small bowl.",
].join(" ");

/**
 * How many times a drawing waits out the provider's rate limit before it
 * gives up: a round or the drawing tool draws many icons one after another,
 * and an account may draw only a few a minute.
 */
const RATE_LIMIT_WAITS = 5;
/** The longest one wait lasts, whatever the provider asks for. */
const LONGEST_WAIT_MS = 60_000;

/** The sections an icon's request appends to the style prompt (ADR-0016). */
export function iconSections(food: FoodToDraw): string[] {
  const kinds = food.kindOf.map((kind) => `, a kind of ${kind}`).join("");

  return [`The food: ${food.name}${kinds}.`, COMPOSITION];
}

/**
 * Draw an Ingredient Icon of a food: the administrator's icon style, then
 * the food and what it is a kind of, so an ambiguous name comes out right
 * ("pepper, a kind of spice"), then the composition the cut-out needs. A
 * square on a transparent background where the provider can draw one, at its
 * cheapest tier unless the maintainers' drawing tool asks for the one above.
 * A refusal for the provider's rate limit is waited out, as long as it asks,
 * a few times over. Answers the drawn bytes; making them an icon is the
 * caller's.
 */
export async function drawIngredientIcon(
  food: FoodToDraw,
  tier: ImageTier = "low"
): Promise<GeneratedImageBytes> {
  for (let waited = 0; ; waited++) {
    try {
      return await generateImage({
        prompt: "ingredient-icon-style",
        sections: iconSections(food),
        shape: "square",
        tier,
        transparent: true,
      });
    } catch (error) {
      const wait = rateLimitWaitMs(error);

      if (wait === null || waited >= RATE_LIMIT_WAITS) throw error;
      await sleep(Math.min(wait, LONGEST_WAIT_MS));
    }
  }
}

/**
 * At or above this probability that a food looks clearly different from the
 * icon it would borrow, it is drawn one of its own; below it, it borrows:
 * every olive oil shows the one bottle. Jev answers this question between
 * about 0.25 and 0.75, and a bar above 0.5 loses onion (0.55) and chicken
 * breast (0.53) before it loses a raspberry variety (0.61): at 0.8 only 4 of
 * 4,657 foods were drawn.
 */
export const OWN_ICON_THRESHOLD = 0.5;

/** A food, and the food whose icon it shows unless it is drawn one: both by name, English where known. */
export interface IconLoan {
  food: string;
  lender: string;
}

/**
 * Which of these foods need an icon of their own, in order: the Decision
 * Model asked of each whether a small icon of it would look clearly
 * different from its lender's, in as many requests as the question limit
 * needs. Throws whatever `decide` throws.
 */
export async function needsOwnIcon(loans: readonly IconLoan[]): Promise<boolean[]> {
  const own: boolean[] = [];

  for (const batch of chunk(loans, MAX_QUESTIONS_PER_DECISION)) {
    const questions: Record<string, DecisionBooleanQuestion> = Object.fromEntries(
      batch.map(({ food, lender }, index) => [
        `food${index}`,
        {
          type: "boolean",
          instructions: `Would a small icon of "${food}" look clearly different from one of "${lender}": another shape, colour, cut or container, so that the ${lender} icon would mislead?`,
        },
      ])
    );
    const { answers } = await decide({
      feature: "ingredient-icon-sharing",
      state:
        "The ingredient icons of a recipe app: one small, simple picture per food, recognisable at a glance.",
      questions,
    });

    own.push(
      ...batch.map((_, index) => answers[`food${index}`]!.probability >= OWN_ICON_THRESHOLD)
    );
  }

  return own;
}
