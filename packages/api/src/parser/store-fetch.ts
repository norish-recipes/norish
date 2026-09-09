/**
 * A Store Visit: one page of a shop's website, fetched. A plain HTTP fetch
 * comes first because a supermarket's markup is written for search engines
 * and needs no browser to read; Obscura renders only when the plain fetch is
 * turned away or comes back empty-handed (ADR-0028). This does not reopen
 * ADR-0019: a plain fetch renders nothing, so Obscura remains the only
 * rendered-page engine, and when a Store page needs rendering it renders it.
 */
import { parserLogger as log } from "@norish/shared-server/logger";

import { fetchRenderedPage } from "./fetch";

/** A browser-shaped identity: a shop that answers people should answer this. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
const FETCH_TIMEOUT_MS = 15_000;
/** Below this, a page with no title of its own is a bot challenge rather than a shop. */
const CHALLENGE_MAX_BYTES = 20_000;

export interface StorePageVisit {
  html: string;
  /**
   * The address the shop answered from. A shop that redirects `dirk.nl` to
   * `www.dirk.nl` writes its links for the latter, and a page is read against
   * the address it came from or its relative links resolve to the wrong host.
   */
  url: string;
  /** Whether Obscura rendered the page, or a plain fetch was enough. */
  rendered: boolean;
}

function looksLikeAChallenge(html: string): boolean {
  return html.length < CHALLENGE_MAX_BYTES && !/<title>\s*[^<\s][^<]*<\/title>/i.test(html);
}

async function plainFetch(
  url: string
): Promise<{ html: string; blocked: boolean; answeredFrom: string }> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: ACCEPT },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const answeredFrom = response.url || url;

    if (response.status === 403) return { html: "", blocked: true, answeredFrom };
    if (!response.ok) {
      log.debug({ url, status: response.status }, "The shop answered a store visit with an error");

      return { html: "", blocked: false, answeredFrom };
    }

    return { html: await response.text(), blocked: false, answeredFrom };
  } catch (error) {
    log.debug({ err: error, url }, "A store visit could not be fetched");

    return { html: "", blocked: false, answeredFrom: url };
  }
}

/**
 * Fetch one page of a shop. `isEmptyHanded` is the caller's own reading of
 * the page, against the address it came from — a results page with no
 * products on it is the third reason to escalate, and only the caller can
 * tell.
 */
export async function fetchStorePage(
  url: string,
  isEmptyHanded?: (html: string, url: string) => boolean
): Promise<StorePageVisit> {
  const plain = await plainFetch(url);
  const at = plain.answeredFrom;
  const escalate =
    plain.blocked ||
    (plain.html !== "" &&
      (looksLikeAChallenge(plain.html) || (isEmptyHanded?.(plain.html, at) ?? false)));

  if (!escalate) return { html: plain.html, url: at, rendered: false };

  // Obscura is optional for this feature: when it is not reachable it answers
  // with no HTML, which is a shop Norish cannot read rather than a failure.
  //
  // A shop that turned the plain fetch away turns the browser away too, and
  // answers it with a bot check that replaces itself with the real page a few
  // seconds later. Rendering is what gets past it, but only if the page is
  // read after it has let go rather than the instant it loads — and, for a
  // shop that draws its shelf in after loading, after the shelf is there.
  // A page that settles empty-handed is still handed back once the wait is up.
  const rendered = await fetchRenderedPage(
    url,
    undefined,
    (html) => !looksLikeAChallenge(html) && !(isEmptyHanded?.(html, at) ?? false)
  );

  if (!rendered) return { html: plain.html, url: at, rendered: false };

  return { html: rendered, url: at, rendered: true };
}
