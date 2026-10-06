import { setTimeout as sleep } from "node:timers/promises";

import { aiLogger } from "@norish/shared-server/logger";

import type { ImageTier } from "../runtime/providers";
import type { GeneratedImageBytes } from "../runtime/runtime";
import { rateLimitWaitMs } from "../runtime/errors";
import { generateImage } from "../runtime/runtime";

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
  "Put it on a plain, flat, evenly lit background of one solid colour that the food itself does not contain.",
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
      aiLogger.info({ food: food.name, waitMs: wait }, "Image provider's rate limit; waiting");
      await sleep(Math.min(wait, LONGEST_WAIT_MS));
    }
  }
}
