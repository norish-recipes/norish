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

export const ingredientColumns = (
  ref: { aliasId: string; ingredientId: string } | null | undefined
) => ({ ingredientAliasId: ref?.aliasId ?? null, ingredientId: ref?.ingredientId ?? null });

/** "x en y" is a grocery each, as a name whose words join two foods is; the first keeps the id. */
export const groceryParts = vi.fn(
  async <T extends { id?: string | null; name: string | null }>(items: readonly T[]) =>
    items.map((item) => {
      const [first, ...rest] = item.name?.split(" en ") ?? [item.name];

      return [{ ...item, name: first }, ...rest.map((name) => ({ ...item, id: undefined, name }))];
    })
);

export const groceryPartsOf = vi.fn(
  async <T extends { id?: string | null; name: string | null }>(item: T) =>
    (await groceryParts([item]))[0]
);
