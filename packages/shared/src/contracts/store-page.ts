/**
 * What the store page reader returns. These shapes cross packages — the
 * reader lives with the parser, the queue calls it through a handler — so
 * they live here rather than in either.
 */

import type { PackSize } from "../lib/pack-size";

/** One product a results page offers: what it is called, where it lives, and what it costs. */
export interface StoreCandidate {
  name: string;
  url: string;
  price?: number;
  currency?: string;
  /** The shop's own words for the pack: "150 gram", "1,5 l", "per stuk", "per kg". */
  size?: string;
  /** What one Shelf Price buys, read out of the size words or the page's data. */
  pack?: PackSize;
  /** The regular price the shop presents beside its price: this is a Sale. */
  regularPrice?: number;
  /** The shop's own words for a deal, on Sale or not: "2 voor €5.50", "ACTIE". */
  dealWords?: string;
}

/** The authoritative reading of a product page: its Shelf Price. */
export interface ProductReading {
  name: string;
  price: number;
  currency: string;
  size?: string;
  pack?: PackSize;
  regularPrice?: number;
  dealWords?: string;
}

/** What a homepage states about how it is searched. */
export type SearchAddressReading =
  { kind: "opensearch"; descriptionUrl: string } | { kind: "form"; searchAddress: string };

/** How a Search Address answered when it was tried. */
export type SearchAddressOutcome =
  /** It answered with products, and some of them were priced. */
  | "products"
  /** It answered, with nothing Norish could price. */
  | "no-products"
  /** The shop answered, with no term known to ask it about. */
  | "answered"
  /** The shop did not answer at all. */
  | "no-answer"
  /** There is no Search Address to try, and none was found. */
  | "no-address";

export interface SearchAddressCheck {
  outcome: SearchAddressOutcome;
  count?: number;
}

/** What a Store knows about its shop after Norish has tried it. */
export interface StoreSearchAddressResult extends SearchAddressCheck {
  searchAddress: string | null;
}
