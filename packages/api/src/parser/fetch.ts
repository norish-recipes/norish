import type { BrowserContext, Page } from "playwright-core";

import type { BrowserRenderer } from "@norish/api/parser/browser-connections";
import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { getBrowser } from "@norish/api/parser/browser-connections";
import { getPageRenderersConfig } from "@norish/shared-server/config/server-config-loader";
import { parserLogger as log } from "@norish/shared-server/logger";
import { byAddress, solve } from "@norish/shared-server/page-renderers";
import {
  addressesOf,
  guardedFetch,
  isPrivate,
  isRefusedHost,
} from "@norish/shared-server/private-addresses";
import { isHostOnDomain } from "@norish/shared/lib/helpers";
import { withTimeout } from "@norish/shared/lib/with-timeout";

/** How long a page that answered with something else is given to become itself. */
const SETTLE_TIMEOUT_MS = 15_000;
const SETTLE_POLL_MS = 500;
const PLAIN_FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 10;
/** Below this, a page with no title of its own, or a block page's title, is a bot check. */
const STUB_MAX_BYTES = 20_000;
const CLOUDFLARE_CHALLENGE = /<title>\s*Just a moment(?:\.\.\.|…)|cf-challenge|_cf_chl_opt/i;
/** Akamai's, Cloudflare's and a web server's own refusals, with an optional "| Site" after them. */
const BLOCK_TITLE =
  /<title>\s*(?:Access Denied|Attention Required!|403 Forbidden)\s*(?:\|[^<]*)?<\/title>/i;
const REFUSAL_STATUSES = new Set([401, 403, 429]);

/**
 * Whether HTML is a bot check rather than the page: Cloudflare's challenge, a small stub with no
 * title or a block page's title, or a refusal status. The one reading every caller shares.
 */
export function isBotCheck(html: string, status?: number | null): boolean {
  return (
    REFUSAL_STATUSES.has(status ?? 0) ||
    CLOUDFLARE_CHALLENGE.test(html) ||
    (html.length < STUB_MAX_BYTES &&
      (BLOCK_TITLE.test(html) || !/<title>\s*[^<\s][^<]*<\/title>/i.test(html)))
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The page, once it is the page rather than whatever stood in front of it. A
 * bot check answers the first navigation with a script and replaces itself
 * with the real page seconds later, so a caller that can tell the two apart is
 * given until the deadline to be handed the second one. Reading a page
 * mid-navigation throws, which is a page still becoming itself and counts as
 * unsettled, as does a read that answers null. A crashed or closed page never
 * becomes itself, so the wait ends there.
 */
async function settledContent(
  page: Page,
  content: (page: Page) => Promise<string | null>,
  isSettled: (html: string) => boolean
): Promise<string> {
  let gone: string | undefined;

  page.on("crash", () => (gone ??= "crashed"));
  page.on("close", () => (gone ??= "closed"));

  const read = async (): Promise<string | null> => {
    try {
      return await content(page);
    } catch {
      return null;
    }
  };
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let html = await read();

  while ((html === null || !isSettled(html)) && Date.now() < deadline) {
    if (gone) throw new Error(`The page ${gone} before it settled`);
    await sleep(SETTLE_POLL_MS);
    html = await read();
  }

  return html ?? "";
}

/** A rendered page and the HTTP status its document last arrived with. */
export interface RenderedPage {
  /** Empty when no Page Renderer produced usable HTML */
  html: string;
  /**
   * The status of the main document's last navigation: a bot check that
   * answers 403 and then hands over the real page reports the real page's.
   * Null when no document response was seen.
   */
  status: number | null;
}

/**
 * Header tokens go only to hosts on their site, through the `scopeDomain` that Norish's Obscura
 * (norish-recipes/obscura) adds and echoes. An Obscura that doesn't echo it would send them to every
 * host the page loads from, so they are cleared again and the import goes without them.
 */
async function sendHeadersToTheirSite(
  context: BrowserContext,
  page: Page,
  tokens: SiteAuthTokenDecryptedDto[],
  targetUrl: string
): Promise<void> {
  const scopeDomain = headerScope(new URL(targetUrl).hostname, tokens);
  const cdp = await context.newCDPSession(page);
  const scoped = {
    headers: Object.fromEntries(tokens.map((token) => [token.name, token.value])),
    scopeDomain,
  };
  const reply = await cdp.send("Network.setExtraHTTPHeaders", scoped);

  if (Reflect.get(reply, "scopeDomain") === scopeDomain) return;

  await cdp.send("Network.setExtraHTTPHeaders", { headers: {} });
  log.warn({ url: targetUrl }, "Obscura cannot keep header tokens to their site, so none are sent");
}

/** The tokens for the host's own site: those whose domain is the host or one it is under. */
function tokensOnSite(
  hostname: string,
  tokens: SiteAuthTokenDecryptedDto[] = []
): SiteAuthTokenDecryptedDto[] {
  return tokens.filter(({ domain }) => isHostOnDomain(hostname, domain));
}

/** The tokens a request carries: its site's, and none over http, where they travel in the clear. */
function tokensFor(
  { hostname, protocol }: URL,
  tokens?: SiteAuthTokenDecryptedDto[]
): SiteAuthTokenDecryptedDto[] {
  return protocol === "https:" ? tokensOnSite(hostname, tokens) : [];
}

/** Tokens split into those sent as headers and those sent as cookies. */
function byType(tokens: SiteAuthTokenDecryptedDto[]) {
  return {
    headerTokens: tokens.filter(({ type }) => type === "header"),
    cookieTokens: tokens.filter(({ type }) => type === "cookie"),
  };
}

/** The narrowest token domain the host is on. */
export function headerScope(hostname: string, tokens: SiteAuthTokenDecryptedDto[]): string {
  return tokensOnSite(hostname, tokens).reduce(
    (narrowest, { domain }) => (domain.length > narrowest.length ? domain : narrowest),
    ""
  );
}

/** A page fetched without a browser. */
export interface PlainPage {
  /** Empty unless the site answered with a 2xx */
  html: string;
  /** Null when no answer arrived */
  status: number | null;
  /** The address the page answered from, after redirects */
  url: string;
  /** Set when the target was a private address and the administrator does not allow those */
  refused?: true;
}

/**
 * Fetch a web page without a browser, following redirects by hand so Site Auth Tokens
 * go only to https hops on their own domain.
 */
export async function plainFetch(
  targetUrl: string,
  userAgent: string,
  options: { headers?: Record<string, string>; tokens?: SiteAuthTokenDecryptedDto[] } = {}
): Promise<PlainPage> {
  const signal = AbortSignal.timeout(PLAIN_FETCH_TIMEOUT_MS);
  const { allowPrivateAddresses } = await getPageRenderersConfig();
  let url = targetUrl;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = URL.parse(url);

      if (!parsed || !/^https?:$/.test(parsed.protocol)) {
        log.warn({ url }, "Refused to fetch a link that is not a web page");

        return { html: "", status: null, url };
      }

      if (await isRefusedHost(parsed.hostname, allowPrivateAddresses)) {
        log.warn({ url }, "Refused to fetch a private address");

        return { html: "", status: null, url, refused: true };
      }

      const { headerTokens, cookieTokens } = byType(tokensFor(parsed, options.tokens));
      const cookie = cookieTokens.map(({ name, value }) => `${name}=${value}`).join("; ");
      const response = await guardedFetch(
        url,
        {
          headers: {
            "user-agent": userAgent,
            ...options.headers,
            ...Object.fromEntries(headerTokens.map(({ name, value }) => [name, value])),
            ...(cookie ? { cookie } : {}),
          },
          redirect: "manual",
          signal,
        },
        allowPrivateAddresses
      );
      const location =
        response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;

      if (location) {
        await response.body?.cancel();
        url = new URL(location, url).href;
        continue;
      }

      const answeredFrom = response.url || url;

      if (!response.ok) {
        log.debug({ url, status: response.status }, "A plain fetch was answered with an error");

        return { html: "", status: response.status, url: answeredFrom };
      }

      return { html: await response.text(), status: response.status, url: answeredFrom };
    }

    log.debug({ url: targetUrl }, "A plain fetch was redirected too many times");

    return { html: "", status: null, url };
  } catch (error) {
    log.debug({ err: error, url: targetUrl }, "A plain fetch failed");

    return { html: "", status: null, url };
  }
}

// `page.evaluate` runs in the page, where `document` exists; this package compiles without DOM types.
declare const document: {
  cookie: string;
  readyState: string;
  documentElement: { outerHTML: string };
};

/** The page's HTML once its document has finished loading, else null; one evaluation, never half. */
function loadedContent(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    document.readyState === "complete" ? document.documentElement.outerHTML : null
  );
}

/**
 * Render a page with the Page Renderers that are switched on and return its HTML.
 *
 * The renderer owns the browser identity, JavaScript execution, page settling,
 * stealth and tracker blocking. Norish adds exactly one thing: the requesting
 * user's Site Auth Tokens, in a context that belongs to this fetch alone.
 *
 * An empty string means no Page Renderer produced usable HTML, and the import
 * path reports that as a fetch failure.
 *
 * `isSettled` is the caller's own reading of whether the rendered HTML is the
 * page it asked for. Only a caller knows: a shop's bot check and a shop's
 * empty results page are the same two kilobytes to everyone else. Without it
 * Obscura's page is read once, the moment it loads, and the Chromium browser's
 * once it is past a bot check.
 */
export async function fetchRenderedPage(
  targetUrl: string,
  tokens?: SiteAuthTokenDecryptedDto[],
  isSettled?: (html: string) => boolean
): Promise<string> {
  return (await renderPage(targetUrl, tokens, isSettled)).html;
}

/** `fetchRenderedPage`, keeping the status a site answered with, so a refusal can be named. */
export async function renderPage(
  targetUrl: string,
  tokens?: SiteAuthTokenDecryptedDto[],
  isSettled?: (html: string) => boolean
): Promise<RenderedPage> {
  // Only a web page reaches a renderer, so a link stored before imports refused other schemes
  // (file:, gopher:) is never rendered.
  if (!/^https?:$/.test(URL.parse(targetUrl)?.protocol ?? "")) {
    log.warn({ url: targetUrl }, "Refused to render a link that is not a web page");

    return { html: "", status: null };
  }

  const renderers = await getPageRenderersConfig();
  const isReadable = (page: RenderedPage) =>
    page.html !== "" && !isBotCheck(page.html, page.status);
  // Asked once, by the first renderer that honours Allow private addresses; Obscura has its own deny.
  let refused: Promise<boolean> | undefined;
  const isRefused = async (renderer: string) => {
    refused ??= isRefusedHost(new URL(targetUrl).hostname, renderers.allowPrivateAddresses);

    if (!(await refused)) return false;
    log.warn({ url: targetUrl }, `Refused to send a private address to the ${renderer}`);

    return true;
  };
  let status: number | null = null;

  if (renderers.obscura.enabled) {
    const rendered = await renderInBrowser(
      "obscura",
      renderers.obscura,
      renderers.navigationTimeoutMs,
      targetUrl,
      tokens,
      {
        prepare: setTokensInObscura,
        // Read once, the moment it loads, unless the caller can tell it is not the page yet.
        read: (page) =>
          isSettled ? settledContent(page, (page) => page.content(), isSettled) : page.content(),
      }
    );

    if (isReadable(rendered)) return answered("obscura", targetUrl, rendered);
    status = rendered.status;
  }

  if (renderers.chromium.enabled && !(await isRefused("Chromium browser"))) {
    const rendered = await renderInBrowser(
      "chromium",
      { endpoint: await byAddress(renderers.chromium.endpoint) },
      renderers.navigationTimeoutMs,
      targetUrl,
      tokens,
      {
        prepare: (context, page, onSite) =>
          prepareChromiumPage(context, page, onSite, renderers.allowPrivateAddresses),
        // Read once loaded and, unless the caller can tell, once past a bot check: Allerhande's
        // reloads into the page seconds after load.
        read: (page) =>
          settledContent(page, loadedContent, isSettled ?? ((html) => !isBotCheck(html))),
      }
    );

    if (isReadable(rendered)) return answered("chromium", targetUrl, rendered);
    status = rendered.status ?? status;
  }

  if (renderers.solver.enabled && renderers.solver.endpoint) {
    // A solver cannot keep tokens to their site, so it never gets them.
    if (tokens?.length) {
      log.info(
        { url: targetUrl, tokens: tokens.length },
        "Site Auth Tokens withheld from the solver"
      );
    }

    if (!(await isRefused("solver"))) {
      const solved = await renderInSolver(
        targetUrl,
        renderers.solver.endpoint,
        renderers.navigationTimeoutMs
      );

      if (isReadable(solved)) return answered("solver", targetUrl, solved);
    }
  }

  // Every renderer that is on failed, so the page is unreadable (ADR-0019).
  return { html: "", status };
}

function answered(
  renderer: BrowserRenderer | "solver",
  url: string,
  page: RenderedPage
): RenderedPage {
  log.info({ url, renderer }, "A Page Renderer read the page");

  return page;
}

/** Ask a FlareSolverr-compatible solver for the page, read once. */
async function renderInSolver(
  targetUrl: string,
  endpoint: string,
  maxTimeout: number
): Promise<RenderedPage> {
  try {
    return { html: await solve(targetUrl, endpoint, maxTimeout), status: null };
  } catch (error) {
    log.warn({ err: error, url: targetUrl }, "The solver could not render the page");

    return { html: "", status: null };
  }
}

/**
 * How a renderer prepares its page before the main navigation, handed the tokens `tokensFor` the
 * target, and how it reads the page after. A navigation of its own keeps within `timeLeft()`.
 */
interface PageSteps {
  prepare: (
    context: BrowserContext,
    page: Page,
    tokens: SiteAuthTokenDecryptedDto[],
    targetUrl: string,
    timeLeft: () => number
  ) => Promise<void>;
  read: (page: Page) => Promise<string>;
}

/** Render a page in a CDP Page Renderer, in a context of this fetch's own. */
async function renderInBrowser(
  renderer: BrowserRenderer,
  { endpoint, cdpToken }: { endpoint: string; cdpToken?: string },
  navigationTimeoutMs: number,
  targetUrl: string,
  tokens: SiteAuthTokenDecryptedDto[] | undefined,
  { prepare, read }: PageSteps
): Promise<RenderedPage> {
  // One deadline for the connection and every navigation; 0 would turn Playwright's timeout off.
  const deadline = Date.now() + navigationTimeoutMs;
  const timeLeft = () => Math.max(deadline - Date.now(), 1);
  let opening: Promise<BrowserContext> | undefined;
  let status: number | null = null;

  const attempt = async (): Promise<string> => {
    const browser = await getBrowser(renderer, endpoint, cdpToken, timeLeft());

    if (!browser) return "";

    const target = new URL(targetUrl);
    const onSite = tokensFor(target, tokens);

    if (target.protocol !== "https:" && tokens?.length) {
      log.info(
        { url: targetUrl, tokens: tokens.length },
        "Site Auth Tokens withheld from an http page"
      );
    }

    // A fresh context per fetch, so one importer's tokens never reach another's page.
    opening = browser.newContext();

    const context = await opening;
    const page = await context.newPage();

    await prepare(context, page, onSite, targetUrl, timeLeft);

    page.on("response", (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
        status = response.status();
      }
    });

    const response = await page.goto(targetUrl, {
      waitUntil: "load",
      // What is left of the one deadline. Waiting past it for the page to become itself has its
      // own, SETTLE_TIMEOUT_MS, because only a caller can tell that it has not.
      timeout: timeLeft(),
    });

    status ??= response?.status() ?? null;

    return read(page);
  };

  try {
    // A page whose main thread is stuck never answers a read, so the attempt as a whole is bounded.
    const html = await withTimeout(
      attempt,
      navigationTimeoutMs + SETTLE_TIMEOUT_MS,
      `Rendering in ${renderer}`
    );

    return { html, status };
  } catch (error) {
    log.warn({ err: error, url: targetUrl, renderer }, "A Page Renderer could not render the page");

    return { html: "", status };
  } finally {
    // Not awaited, as a dead connection never answers; a context that opens late is closed then.
    void opening
      ?.then((context) => context.close())
      .catch((err: unknown) => {
        log.debug({ err, renderer }, "Failed to close a browser context during cleanup");
      });
  }
}

/** Obscura's tokens: headers through its `scopeDomain`, cookies set from the target's own origin. */
async function setTokensInObscura(
  context: BrowserContext,
  page: Page,
  tokens: SiteAuthTokenDecryptedDto[],
  targetUrl: string,
  timeLeft: () => number
): Promise<void> {
  const { headerTokens, cookieTokens } = byType(tokens);

  if (headerTokens.length > 0) await sendHeadersToTheirSite(context, page, headerTokens, targetUrl);

  // Obscura never sends a cookie set over CDP but does send one a page sets, so the tokens are set
  // from the target's origin, for the token's domain, secure, and stay within it.
  if (cookieTokens.length > 0) {
    await page.goto(new URL("/robots.txt", targetUrl).href, {
      waitUntil: "domcontentloaded",
      timeout: timeLeft(),
    });
    await page.evaluate(
      (lines) => {
        for (const line of lines) document.cookie = line;
      },
      cookieTokens.map(
        ({ name, value, domain }) => `${name}=${value}; path=/; domain=${domain}; secure`
      )
    );
  }
}

/**
 * A `Fetch.enable` pauses requests on a header token's site, and documents while private addresses
 * are refused, to check each hop and add its own site's headers; `route` headers follow redirects.
 */
async function prepareChromiumPage(
  context: BrowserContext,
  page: Page,
  tokens: SiteAuthTokenDecryptedDto[],
  allowPrivateAddresses: boolean
): Promise<void> {
  const { headerTokens, cookieTokens } = byType(tokens);
  const headerDomains = new Set(headerTokens.map(({ domain }) => domain));
  // The site and its subdomains, with or without a port. A `*` can still match past the host, so
  // each paused request is checked by its own host.
  const patterns = [
    ...[...headerDomains].flatMap((domain) =>
      [
        `https://${domain}/*`,
        `https://${domain}:*`,
        `https://*.${domain}/*`,
        `https://*.${domain}:*`,
      ].map((urlPattern) => ({
        urlPattern,
        requestStage: "Request" as const,
      }))
    ),
    ...(allowPrivateAddresses
      ? []
      : [{ resourceType: "Document" as const, requestStage: "Request" as const }]),
  ];

  // Chromium sends a cookie set over CDP, unlike Obscura, and keeps it to its domain.
  if (cookieTokens.length > 0) {
    await context.addCookies(
      cookieTokens.map(({ name, value, domain }) => ({
        name,
        value,
        domain: `.${domain}`,
        path: "/",
        secure: true,
      }))
    );
  }

  if (patterns.length === 0) return;

  const cdp = await context.newCDPSession(page);

  cdp.on("Fetch.requestPaused", ({ requestId, request, resourceType }) => {
    const answer = async () => {
      const url = new URL(request.url);

      // A host that does not resolve rejects here and is failed, so Chromium never resolves it.
      if (
        resourceType === "Document" &&
        !allowPrivateAddresses &&
        (await addressesOf(url.hostname)).some(isPrivate)
      ) {
        log.warn({ url: request.url }, "Refused a private address in the Chromium browser");
        await cdp.send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });

        return;
      }

      // As in the plain fetch, a header goes only to an https request on its own site.
      const onSite = tokensFor(url, headerTokens);
      const replaced = new Set(onSite.map(({ name }) => name.toLowerCase()));

      await cdp.send(
        "Fetch.continueRequest",
        onSite.length === 0
          ? { requestId }
          : {
              requestId,
              headers: [
                ...Object.entries(request.headers)
                  .filter(([name]) => !replaced.has(name.toLowerCase()))
                  .map(([name, value]) => ({ name, value })),
                ...onSite.map(({ name, value }) => ({ name, value })),
              ],
            }
      );
    };

    // Every paused request is answered, and one that cannot be checked goes nowhere.
    answer().catch(async (error: unknown) => {
      log.debug({ err: error, url: request.url }, "The Chromium browser failed a request");
      await cdp.send("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => {});
    });
  });
  await cdp.send("Fetch.enable", { patterns });
}
