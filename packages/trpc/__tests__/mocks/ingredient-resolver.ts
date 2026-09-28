import { vi } from "vitest";

/**
 * The ingredient resolver without a catalogue: each text is its own
 * Ingredient, keyed by its trimmed lowercase self, so a test can see which
 * Ingredient a write or a read was about.
 */
function answer(text: string) {
  const key = text.trim().toLowerCase();

  return { text: text.trim(), aliasId: `alias:${key}`, ingredientId: `ingredient:${key}` };
}

export const resolveIngredients = vi.fn(async (texts: readonly string[]) => texts.map(answer));

export const resolveIngredient = vi.fn(async (text: string) =>
  cleanIngredientText(text) ? answer(text) : null
);

export const findIngredientFor = vi.fn(async (text: string) => {
  const { aliasId, ingredientId } = answer(text);

  return text.trim() ? { aliasId, ingredientId } : null;
});

/** Text as the resolver reads it: markup gone, whitespace collapsed. */
export const cleanIngredientText = (text: string) =>
  text
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** A spelling's fold, as the resolver keys an alias by it. */
export const ingredientAliasFold = (text: string) => text.trim().toLowerCase();

/** Nothing goes away under a test: the one attempt is the answer. */
export const retryOnStaleIngredient = <T>(attempt: () => Promise<T>) => attempt();

export const isStaleIngredientReference = () => false;
