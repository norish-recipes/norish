import { vi } from "vitest";

/**
 * Grocery names resolved without a catalogue: each name is its own alias,
 * keyed by its lowercase self, so a test can see which alias a write carried.
 */
export const resolveGroceryNames = vi.fn(async (items: ReadonlyArray<{ name: string | null }>) =>
  items.map((item) => {
    const name = item.name?.trim().toLowerCase();

    return name ? { aliasId: `alias:${name}`, ingredientId: `ingredient:${name}` } : null;
  })
);
