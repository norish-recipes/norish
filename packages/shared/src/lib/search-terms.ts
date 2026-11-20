/** The most words a search looks for; the rest of a longer text is ignored. */
export const SEARCH_WORDS_MAX = 16;

/** The words of a search, as the server queries them: whitespace-split, tsquery characters dropped. */
export function searchTerms(search: string): string[] {
  return search
    .split(/\s+/)
    .map((term) => term.replace(/[&|!():<>*\\'"]/g, "").trim())
    .filter((term) => term.length > 0)
    .slice(0, SEARCH_WORDS_MAX);
}

/** Each term split at punctuation: what the match's any-word fallback ORs ("chicken,rice" → chicken, rice). */
export function searchWords(search: string): string[] {
  return searchTerms(search)
    .flatMap((term) => term.split(/[^\p{L}\p{M}\p{N}]+/u).filter((word) => word.length > 0))
    .slice(0, SEARCH_WORDS_MAX);
}
