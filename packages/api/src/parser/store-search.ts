/**
 * What a shop's website tells Norish about searching it: the Search Address
 * it can be searched with, and whether that address works. Both are language
 * neutral by construction — the rungs that read words are the last ones, and
 * the probe is the user's own term rather than a word this repo happens to
 * know (see ADR-0028 and the spec's note on the fourteen locales).
 */
import type { SearchAddressCheck } from "@norish/shared/contracts";
import { parserLogger as log } from "@norish/shared-server/logger";
import { pricedCandidates } from "@norish/shared/lib/currency";
import { resolveSearchAddress } from "@norish/shared/lib/search-address";

import { fetchStorePage } from "./store-fetch";
import { readSearchResults } from "./store-page";
import { readOpenSearchTemplate, readSearchAddressFromPage } from "./store-search-address";

/**
 * The Search Address a shop's own homepage states, or nothing. Finding
 * nothing is a normal outcome: the store keeps its website and the form asks
 * for a search address in plain words.
 */
export async function discoverSearchAddress(website: string): Promise<string | null> {
  const visit = await fetchStorePage(website);

  if (!visit.html) return null;
  const reading = readSearchAddressFromPage(visit.html, visit.url ?? website);

  if (!reading) return null;
  if (reading.kind === "form") return reading.searchAddress;

  const descriptor = await fetchStorePage(reading.descriptionUrl);

  if (!descriptor.html) return null;

  return readOpenSearchTemplate(descriptor.html, descriptor.url ?? reading.descriptionUrl);
}

/**
 * Whether a Search Address works, asked with the term the user's own paste
 * carried. A fixed English probe would report "no products found" against a
 * Polish shop that works perfectly — the probe would be wrong, not the
 * address. With no term known, the shop is asked only whether it answers.
 */
export async function verifySearchAddress(
  searchAddress: string,
  term: string | null
): Promise<SearchAddressCheck> {
  if (!term) {
    const origin = originOf(searchAddress);
    const visit = origin ? await fetchStorePage(origin) : { html: "" };

    return visit.html ? { outcome: "answered" } : { outcome: "no-answer" };
  }

  const url = resolveSearchAddress(searchAddress, term);
  const visit = await fetchStorePage(
    url,
    (html, at) => pricedCandidates(readSearchResults(html, at)).length === 0
  );

  if (!visit.html) return { outcome: "no-answer" };
  const count = pricedCandidates(readSearchResults(visit.html, visit.url ?? url)).length;

  log.debug({ url, count, rendered: visit.rendered }, "Verified a Search Address");

  return count > 0 ? { outcome: "products", count } : { outcome: "no-products" };
}

function originOf(searchAddress: string): string | null {
  try {
    return new URL(resolveSearchAddress(searchAddress, "term")).origin;
  } catch {
    return null;
  }
}
