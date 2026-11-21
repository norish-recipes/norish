/** The most words a search looks for; the rest of a longer text is ignored. */
export const SEARCH_WORDS_MAX = 16;

/** The words of a search, as the server queries them: whitespace-split, tsquery characters and wordless terms dropped. */
export function searchTerms(search: string): string[] {
  return search
    .split(/\s+/)
    .map((term) => term.replace(/[&|!():<>*\\'"]/g, "").trim())
    .filter((term) => /[\p{L}\p{M}\p{N}]/u.test(term))
    .slice(0, SEARCH_WORDS_MAX);
}

/** Whether `text` holds a search word: text without one ("-", "  ") counts as no text anywhere. */
export function hasSearchText(text: string | undefined): boolean {
  return text !== undefined && searchWords(text).length > 0;
}

/** Each term split at punctuation: what the match's any-word fallback ORs ("chicken,rice" → chicken, rice). */
export function searchWords(search: string): string[] {
  return searchTerms(search)
    .flatMap((term) => term.split(/[^\p{L}\p{M}\p{N}]+/u).filter((word) => word.length > 0))
    .slice(0, SEARCH_WORDS_MAX);
}
