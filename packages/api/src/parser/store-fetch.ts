/**
 * A Store Visit: one page of a shop's website, fetched. A plain HTTP fetch
 * comes first because a supermarket's markup is written for search engines
 * and needs no browser to read; the Page Renderers render only when the plain
 * fetch is turned away or comes back empty-handed (ADR-0028, ADR-0019).
 */
import { fetchRenderedPage, isBotCheck, plainFetch } from "./fetch";

/** A browser-shaped identity: a shop that answers people should answer this. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

export interface StorePageVisit {
  html: string;
  /**
   * The address the shop answered from. A shop that redirects `dirk.nl` to
   * `www.dirk.nl` writes its links for the latter, and a page is read against
   * the address it came from or its relative links resolve to the wrong host.
   */
  url: string;
  /** Whether a Page Renderer rendered the page, or a plain fetch was enough. */
  rendered: boolean;
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
  const plain = await plainFetch(url, USER_AGENT, { headers: { accept: ACCEPT } });
  const at = plain.url;
  const escalate =
    plain.status === 403 ||
    (plain.html !== "" && (isBotCheck(plain.html) || (isEmptyHanded?.(plain.html, at) ?? false)));

  if (!escalate) return { html: plain.html, url: at, rendered: false };

  // Page Renderers are optional for this feature: with none on or none able to
  // read it, the answer is no HTML, which is a shop Norish cannot read rather than a failure.
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
    (html) => !isBotCheck(html) && !(isEmptyHanded?.(html, at) ?? false)
  );

  if (!rendered) return { html: plain.html, url: at, rendered: false };

  return { html: rendered, url: at, rendered: true };
}
