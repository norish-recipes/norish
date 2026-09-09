import type { ResolvedProductLink } from "../contracts/dto/store-products";
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
  return { storeId, normalizedName: normalizeGroceryName(name), triedAt: null, product: null };
}
