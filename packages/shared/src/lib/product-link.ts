import type { ProductSuggestion, ResolvedProductLink } from "../contracts/dto/store-products";
import type { StoreCandidate } from "../contracts/store-page";
import { normalizeGroceryName } from "./normalized-name";

/**
 * The three things a Product Link can say. A row pointing at a product is a
 * link; a row with no product that holds when it was tried is a Miss, what
 * the shop said; and a row with neither is a Pending Link — the Store has
 * been asked and has not answered yet. Nothing on the wire says "pending"
 * in so many words: the absence of both is what says it, so every reader of
 * a link asks this rather than the fields.
 */
export function isPendingLink(
  link: Pick<ResolvedProductLink, "product" | "triedAt"> | null | undefined
): boolean {
  return Boolean(link) && link!.product === null && link!.triedAt === null;
}

/** The Pending Link the producer announces the moment it asks a Store a question. */
export function pendingLink(storeId: string, name: string): ResolvedProductLink {
  return {
    storeId,
    normalizedName: normalizeGroceryName(name),
    triedAt: null,
    product: null,
    suggestion: null,
  };
}

/**
 * The shop's offered products in the order a Decision put them (ADR-0035):
 * the ones it ranked most likely first, the rest in the shop's own order
 * after them, and the best guess marked where the Decision cleared the bar
 * for one. Without a suggestion the list is the shop's, untouched. Pure, so
 * the panel's query path spends nothing beyond reading what the lookup kept.
 */
export function orderBySuggestion<T extends StoreCandidate>(
  candidates: readonly T[],
  suggestion: ProductSuggestion | null | undefined
): T[] {
  if (!suggestion) return [...candidates];

  const rank = new Map(suggestion.ranked.map((entry, index) => [entry.url, index]));
  const ranked = candidates
    .filter((candidate) => rank.has(candidate.url))
    .sort((a, b) => rank.get(a.url)! - rank.get(b.url)!);
  const unranked = candidates.filter((candidate) => !rank.has(candidate.url));

  return [...ranked, ...unranked].map((candidate) =>
    suggestion.best !== null && candidate.url === suggestion.best
      ? { ...candidate, suggested: true }
      : candidate
  );
}
