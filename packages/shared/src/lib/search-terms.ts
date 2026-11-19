/** The words of a search, as the server queries them: whitespace-split, tsquery characters dropped. */
export function searchTerms(search: string): string[] {
  return search
    .split(/\s+/)
    .map((term) => term.replace(/[&|!():<>*\\'"]/g, "").trim())
    .filter((term) => term.length > 0);
}
