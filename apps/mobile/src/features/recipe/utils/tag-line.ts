/** The header's line of Categories then tags, a tag the same as a Category (any case) left out. */
export function tagLine(categories: readonly string[], tags: readonly string[]): string {
  const named = new Set(categories.map((name) => name.toLowerCase()));

  return [...categories, ...tags.filter((tag) => !named.has(tag.toLowerCase()))].join(", ");
}
