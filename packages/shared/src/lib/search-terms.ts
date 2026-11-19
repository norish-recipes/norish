/** The words of a search, as the server queries them: whitespace-split, tsquery characters dropped,
 * and a term with no letter or digit ("^") left out, as nothing can match it. */
export function searchTerms(search: string): string[] {
  return search
    .split(/\s+/)
    .map((term) => term.replace(/[&|!():<>*\\'"]/g, "").trim())
    .filter((term) => /[\p{L}\p{N}]/u.test(term));
}

/** Each term split at punctuation: what the match's any-word fallback ORs ("chicken,rice" → chicken, rice). */
export function searchWords(search: string): string[] {
  return searchTerms(search).flatMap((term) =>
    term.split(/[^\p{L}\p{M}\p{N}]+/u).filter((word) => word.length > 0)
  );
}
