import type { StoreCandidate } from "../contracts/store-page";

/**
 * What a shop's top-level domain implies it charges in. Read only when the
 * page itself states nothing: a self-hosted Norish is used well past the
 * places its authors shop, so the table covers the locales it ships and the
 * neighbours of those. `.com` is deliberately absent — a Dutch shop on a
 * `.com` charges in euros, and a page that states a number with no mark and
 * no country is a page whose prices go unread rather than misread.
 */
const TLD_CURRENCIES: Record<string, string> = {
  nl: "EUR",
  be: "EUR",
  de: "EUR",
  at: "EUR",
  fr: "EUR",
  es: "EUR",
  it: "EUR",
  pt: "EUR",
  ie: "EUR",
  fi: "EUR",
  gr: "EUR",
  uk: "GBP",
  ch: "CHF",
  dk: "DKK",
  no: "NOK",
  se: "SEK",
  pl: "PLN",
  cz: "CZK",
  hu: "HUF",
  ro: "RON",
  bg: "BGN",
  ru: "RUB",
  kr: "KRW",
  jp: "JPY",
  ca: "CAD",
  au: "AUD",
  nz: "NZD",
  br: "BRL",
  us: "USD",
};

export function currencyForUrl(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null;
  try {
    const tld = new URL(pageUrl).hostname.split(".").pop() ?? "";

    return TLD_CURRENCIES[tld.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

/**
 * A candidate carrying both a price and the currency it is in. A price without
 * a currency is not a reading, and an unpriced candidate is never offered:
 * the whole point of showing one is showing what it costs.
 */
export type PricedCandidate = StoreCandidate & { price: number; currency: string };

export function isPriced(candidate: StoreCandidate): candidate is PricedCandidate {
  return candidate.price !== undefined && candidate.currency !== undefined;
}

export function pricedCandidates(candidates: StoreCandidate[]): PricedCandidate[] {
  return candidates.filter(isPriced);
}
