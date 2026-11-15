import type { StoreProductChoice, StoreProductDto } from "@norish/shared/contracts";
import type { PricedCandidate } from "@norish/shared/lib/currency";
import type { PackSizeWords } from "@norish/shared/lib/format-price";
import type { PackSize } from "@norish/shared/lib/pack-size";
import { nameWords } from "@norish/shared/lib/fold-name";
import { formatPackSize } from "@norish/shared/lib/format-price";
import { packSizeOf } from "@norish/shared/lib/pack-size";
import { saleRegularPrice } from "@norish/shared/lib/sale";

/** One row of the dropdown, whichever list it came from. */
export interface ProductRow {
  key: string;
  name: string;
  /** The shop's size words, or else Norish's own for the pack. */
  packWords: string | null;
  /** The product's own page at the shop, where it was read from one. */
  pageUrl: string | null;
  price: number;
  currency: string;
  size: string | null;
  /** What one Shelf Price buys, as read or as set by hand. */
  pack: PackSize | null;
  /** The regular price the shop struck through, where this is a Sale. */
  regularPrice: number | null;
  /** The shop's own words for its deal, on Sale or not. */
  dealWords: string | null;
  choice: StoreProductChoice;
}

/** The shop's size words, or else Norish's own for the pack. */
export function packWordsOf(
  size: string | null | undefined,
  pack: PackSize | null | undefined,
  words: PackSizeWords
): string | null {
  return size ?? (pack ? formatPackSize(pack, words) : null);
}

export function candidateRow(candidate: PricedCandidate, words: PackSizeWords): ProductRow {
  return {
    key: candidate.url,
    name: candidate.name,
    packWords: packWordsOf(candidate.size, candidate.pack, words),
    pageUrl: candidate.url,
    price: candidate.price,
    currency: candidate.currency,
    size: candidate.size ?? null,
    pack: candidate.pack ?? null,
    regularPrice: saleRegularPrice(candidate.price, candidate.regularPrice),
    dealWords: candidate.dealWords ?? null,
    choice: { kind: "candidate", candidate },
  };
}

export function productRow(product: StoreProductDto, words: PackSizeWords): ProductRow {
  const pack = packSizeOf(product);

  return {
    key: product.id,
    name: product.name,
    packWords: packWordsOf(product.size, pack, words),
    pageUrl: product.pageUrl,
    price: product.price,
    currency: product.currency,
    size: product.size,
    pack,
    regularPrice: saleRegularPrice(product.price, product.regularPrice),
    dealWords: product.dealWords,
    choice: { kind: "product", storeProductId: product.id },
  };
}

/** Which row the held choice is, so the field reads what is linked. */
export function selectedKey(choice: StoreProductChoice | null): string | null {
  if (choice?.kind === "product") return choice.storeProductId;
  if (choice?.kind === "candidate") return choice.candidate.url;

  return null;
}

/**
 * Whether a product the Store already stored is an answer to this question.
 * The shop filters its own answers; nothing filters what the Store has lying
 * around, so a search for "cola" must not hand back last week's cheese. The
 * words are the auto-link rule's own, so the two never disagree on what a word is.
 */
export function answers(name: string, term: string): boolean {
  const asked = nameWords(term);

  if (asked.length === 0) return true;
  const has = nameWords(name);

  // A long enough word may sit inside one of the name's own — "cola" answers
  // "Coca-Cola" — but a short one must be a word in its own right, or the "l"
  // of "1 L" would answer every question with an l in it.
  return asked.some((word) =>
    word.length < 3 ? has.includes(word) : has.some((part) => part.includes(word))
  );
}
