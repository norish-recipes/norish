import { httpUrlSchema } from "./schema";

/**
 * The place a search term goes in a Search Address. A Search Address is an
 * absolute http(s) address carrying this placeholder exactly once; anything
 * else is a website, not a way to search it.
 */
export const SEARCH_ADDRESS_PLACEHOLDER = "{query}";

function placeholderCount(value: string): number {
  return value.split(SEARCH_ADDRESS_PLACEHOLDER).length - 1;
}

export function isSearchAddress(value: string): boolean {
  if (placeholderCount(value) !== 1) return false;

  // The placeholder itself is not a valid URL character, so validate the
  // address with a plain term in its place.
  return httpUrlSchema.safeParse(value.replace(SEARCH_ADDRESS_PLACEHOLDER, "term")).success;
}

/** The address a search for `term` is fetched from. */
export function resolveSearchAddress(searchAddress: string, term: string): string {
  return searchAddress.replace(SEARCH_ADDRESS_PLACEHOLDER, encodeURIComponent(term));
}

/**
 * What a pasted link turns out to be: a way to search the shop, with the term
 * the paste happened to carry, or nothing but the shop's website. `null` means
 * the paste was not an http address at all.
 */
export type SearchAddressDerivation =
  | { kind: "address"; searchAddress: string; website: string; term: string | null }
  | { kind: "website"; website: string };

/**
 * ASCII literals a machine writes, in every language a shop is written in:
 * flags, and the values a search form gives its own mode fields —
 * `searchType=keyword`, `view=grid`, `sort=relevance`. Values, never names.
 */
const MACHINE_LITERALS = new Set([
  "true",
  "false",
  "yes",
  "no",
  "on",
  "off",
  "null",
  "none",
  "all",
  "any",
  "default",
  "keyword",
  "keywords",
  "search",
  "query",
  "text",
  "product",
  "products",
  "relevance",
  "asc",
  "desc",
  "list",
  "grid",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `nl`, `en-US`, `pt_BR`: a bare pair of letters, or a language and its region. */
const LOCALE_TAG = /^[a-z]{2}([-_][a-z]{2,4})?$/i;
const HEX_ID = /^[0-9a-f]{12,}$/i;
const SHORT_ASCII_TOKEN = /^[a-z]{1,4}$/i;

function decodeValue(raw: string, plusIsSpace: boolean): string {
  const candidate = plusIsSpace ? raw.replace(/\+/g, " ") : raw;

  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
}

function isIdLike(value: string): boolean {
  if (HEX_ID.test(value)) return true;
  const digits = value.replace(/\D/g, "").length;

  return digits > 0 && digits * 2 >= value.length;
}

/**
 * Whether a value looks like something a person typed rather than something a
 * page put there. It is asked of the *value*, never of the name beside it:
 * Norish is self-hosted well past the fourteen locales it ships, and a list of
 * search words is a list that is wrong everywhere it has not been extended.
 *
 * `allowShortToken` is off where a machine writes short words — a URL with
 * several parameters holds sort keys and view modes — and on where only a
 * person does: a sole parameter, and a path segment.
 */
function looksTyped(
  value: string,
  options: { allowShortToken: boolean; pathSegments: string[] }
): boolean {
  const candidate = value.trim();

  if (!candidate) return false;
  // `\p{L}`, not `[a-z]`: a Cyrillic or Hangul term fails the first rung otherwise.
  if (!/\p{L}/u.test(candidate)) return false;
  if (MACHINE_LITERALS.has(candidate.toLowerCase())) return false;
  if (LOCALE_TAG.test(candidate)) return false;
  if (UUID.test(candidate)) return false;
  if (isIdLike(candidate)) return false;
  if (!options.allowShortToken && SHORT_ASCII_TOKEN.test(candidate)) return false;

  return !options.pathSegments.some((segment) => segment.toLowerCase() === candidate.toLowerCase());
}

/**
 * How good a guess a value is where two of them both look typed. A phrase
 * beats a word, and a longer word beats a shorter one; the field stays
 * editable either way, so a ranked guess costs a keystroke and a wrong
 * certainty costs trust.
 */
function rank(value: string): number {
  const letters = (value.match(/\p{L}/gu) ?? []).length;

  return (/\s/.test(value.trim()) ? 100 : 0) + Math.min(letters, 24);
}

function rebuild(url: URL, pathname: string, search: string): string {
  return `${url.origin}${pathname}${search ? `?${search}` : ""}${url.hash}`;
}

/** The parameter of a query string whose value a person most likely typed. */
function fromQuery(
  url: URL,
  pathSegments: string[]
): { searchAddress: string; term: string } | null {
  const raw = url.search.slice(1);

  if (!raw) return null;
  const pairs = raw.split("&");
  const allowShortToken = pairs.length === 1;
  let best: { searchAddress: string; term: string; score: number } | null = null;

  pairs.forEach((pair, index) => {
    const separator = pair.indexOf("=");

    if (separator < 0) return;
    const term = decodeValue(pair.slice(separator + 1), true);

    if (!looksTyped(term, { allowShortToken, pathSegments })) return;
    const score = rank(term);

    if (best && best.score >= score) return;
    const replaced = [...pairs];

    replaced[index] = `${pair.slice(0, separator)}=${SEARCH_ADDRESS_PLACEHOLDER}`;
    best = {
      searchAddress: rebuild(url, url.pathname, replaced.join("&")),
      term,
      score,
    };
  });

  return best;
}

/**
 * The trailing path segment, when a person typed it. Only under a section:
 * `/zoeken/producten/kaas` is a search, `/producten` is a page of the shop.
 */
function fromPath(
  url: URL,
  pathSegments: string[]
): { searchAddress: string; term: string } | null {
  const parts = url.pathname.split("/");
  let lastIndex = parts.length - 1;

  while (lastIndex >= 0 && parts[lastIndex] === "") lastIndex -= 1;
  const last = lastIndex >= 0 ? parts[lastIndex] : undefined;

  if (!last || pathSegments.length < 2) return null;
  if (/\.[a-z0-9]{2,5}$/i.test(last)) return null;
  const term = decodeValue(last, false);
  const others = pathSegments.slice(0, -1);

  if (!looksTyped(term, { allowShortToken: true, pathSegments: others })) return null;
  const replaced = [...parts];

  replaced[lastIndex] = SEARCH_ADDRESS_PLACEHOLDER;

  return { searchAddress: rebuild(url, replaced.join("/"), url.search.slice(1)), term };
}

/**
 * What a pasted link says about how the shop is searched. The user never
 * authors a template: they paste the homepage, or a search they just ran, and
 * the slot is found by the shape of a value rather than the meaning of the
 * name beside it.
 */
export function deriveSearchAddress(pasted: string): SearchAddressDerivation | null {
  const trimmed = pasted.trim();

  if (!trimmed) return null;
  if (placeholderCount(trimmed) > 0) {
    if (!isSearchAddress(trimmed)) return null;
    const probe = new URL(resolveSearchAddress(trimmed, "term"));

    return { kind: "address", searchAddress: trimmed, website: probe.origin, term: null };
  }
  if (!httpUrlSchema.safeParse(trimmed).success) return null;
  const url = new URL(trimmed);
  const pathSegments = url.pathname
    .split("/")
    .filter((part) => part !== "")
    .map((part) => decodeValue(part, false));
  const found = fromQuery(url, pathSegments) ?? fromPath(url, pathSegments);

  if (!found) return { kind: "website", website: url.origin };

  return {
    kind: "address",
    searchAddress: found.searchAddress,
    website: url.origin,
    term: found.term,
  };
}
