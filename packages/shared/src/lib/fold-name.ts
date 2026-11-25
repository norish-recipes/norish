/** The text without its diacritics, in composed form: what every fold here starts from. */
export function stripDiacritics(text: string): string {
  // Back together again: NFD takes a Hangul syllable apart too, and nothing
  // else puts it back.
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .normalize("NFC");
}

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

  return stripDiacritics(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The words of a folded name, as the auto-link rule counts them. */
export function nameWords(name: string): string[] {
  return foldName(name)
    .split(" ")
    .filter((word) => word.length > 0);
}

/**
 * What a Tag, Cuisine or Category is unique on within its list (ADR-0043): its
 * fold, or the trimmed name when nothing is left to fold ("🔥").
 */
export function entryFold(name: string): string {
  return foldName(name) || name.trim();
}
