/** The most Recent Searches kept. */
export const RECENT_LIMIT = 10;

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** `list` with `text` newest: trimmed, a repeat in any case moves to the top with the latest spelling,
 * the oldest drop past the limit; blank text changes nothing. */
export function addRecent(list: readonly string[], text: string): string[] {
  const kept = text.trim();

  if (kept === "") return [...list];

  return [kept, ...list.filter((item) => !sameText(item, kept))].slice(0, RECENT_LIMIT);
}

/** The list a device stored, read defensively: only texts, no repeats, newest first, within the limit. */
export function parseRecents(stored: unknown): string[] {
  if (!Array.isArray(stored)) return [];

  const texts = stored.filter((item): item is string => typeof item === "string");

  // Oldest first, so the newest of a repeat is the one added last and wins.
  return texts.reduceRight<string[]>((list, text) => addRecent(list, text), []);
}
