/**
 * The one folding of a name used everywhere a Grocery is matched against what
 * a shop sells: as the key of a Product Link, and as the rule that decides
 * whether a candidate is unmistakably the thing the user asked for. It folds
 * case, diacritics, punctuation and whitespace and nothing else — "Oude Kaas",
 * "oude  kaas" and "Oude kaas!" are one name, "oude kaasjes" is another.
 */
export function normalizeGroceryName(name: string | null | undefined): string {
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

/** The words of a normalized name, as the auto-link rule counts them. */
export function nameWords(name: string): string[] {
  return normalizeGroceryName(name)
    .split(" ")
    .filter((word) => word.length > 0);
}

/**
 * What a Store knows about one grocery name, as one key. Every place that
 * holds Product Links in a map — the pricing router, the repository, the
 * client's price cache — spells the key with this and nothing else.
 */
export function productLinkKey(storeId: string, normalizedName: string): string {
  return `${storeId}|${normalizedName}`;
}

/**
 * The key of an Aisle Link, which is keyed exactly as a Product Link is: a
 * Store and a normalized grocery name (ADR-0031). One spelling, so the aisle
 * cache, the repository and the router never disagree on it.
 */
export const aisleLinkKey = productLinkKey;
