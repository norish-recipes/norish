import type { ImageTier } from "../runtime/providers";
import type { GeneratedImageBytes } from "../runtime/runtime";
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

/** The sections an icon's request appends to the style prompt (ADR-0016). */
export function iconSections(food: FoodToDraw): string[] {
  const kinds = food.kindOf.map((kind) => `, a kind of ${kind}`).join("");

  return [`The food: ${food.name}${kinds}.`, COMPOSITION];
}

/**
 * Draw an Ingredient Icon of a food: the administrator's icon style, then
 * the food and what it is a kind of, so an ambiguous name comes out right
 * ("pepper, a kind of spice"), then the composition the cut-out needs. A
 * square, at the provider's cheapest tier unless the maintainers' drawing
 * tool asks for the one above. Answers the drawn bytes; making them an icon
 * is the caller's.
 */
export async function drawIngredientIcon(
  food: FoodToDraw,
  tier: ImageTier = "low"
): Promise<GeneratedImageBytes> {
  return await generateImage({
    prompt: "ingredient-icon-style",
    sections: iconSections(food),
    shape: "square",
    tier,
  });
}
