/**
 * The one folding of a name: case, diacritics, punctuation and whitespace and
 * nothing else — "Oude Kaas", "oude  kaas" and "Oude kaas!" fold alike,
 * "oude kaasjes" does not. It keys an Ingredient Alias (through the resolver's
 * `ingredientAliasFold`), and otherwise serves search and display: whether a
 * shop's product is unmistakably the thing asked for, and matching text that
 * nothing has resolved yet. It decides no identity of its own (ADR-0037).
 */
export function foldName(name: string | null | undefined): string {
  if (!name) return "";

  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      // Back together again: NFD takes a Hangul syllable apart too, and nothing
      // above put it back.
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );
}

/** The words of a folded name, as the auto-link rule counts them. */
export function nameWords(name: string): string[] {
  return foldName(name)
    .split(" ")
    .filter((word) => word.length > 0);
}
