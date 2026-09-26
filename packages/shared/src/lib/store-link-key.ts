/**
 * What a Store knows about one Ingredient, as one key. Every place that holds
 * Product Links in a map — the pricing router, the repository, the client's
 * price cache — spells the key with this and nothing else (ADR-0037).
 */
export function productLinkKey(storeId: string, ingredientId: string): string {
  return `${storeId}|${ingredientId}`;
}

/**
 * The key of an Aisle Link, which is keyed exactly as a Product Link is: a
 * Store and an Ingredient (ADR-0031, ADR-0037). One spelling, so the aisle
 * cache, the repository and the router never disagree on it.
 */
export const aisleLinkKey = productLinkKey;
