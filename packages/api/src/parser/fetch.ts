import type { BrowserContext, Page } from "playwright-core";

import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { getBrowser } from "@norish/api/obscura";
import { parserLogger as log } from "@norish/shared-server/logger";

/**
 * The whole navigation budget. One deadline rather than a stack of them: the
 * page settling and the recipe-shaped selector races that used to sit under
 * this one are Obscura's job now, and the parser's. Waiting past the
 * navigation for a page to become itself has its own deadline below, because
 * only a caller can tell that it has not.
 */
const NAVIGATION_TIMEOUT_MS = 30_000;

/** How long a page that answered with something else is given to become itself. */
const SETTLE_TIMEOUT_MS = 15_000;
const SETTLE_POLL_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The page, once it is the page rather than whatever stood in front of it. A
 * bot check answers the first navigation with a script and replaces itself
 * with the real page seconds later, so a caller that can tell the two apart is
 * given until the deadline to be handed the second one. Reading a page
 * mid-navigation throws, which is a page still becoming itself and counts as
 * unsettled.
 */
async function settledContent(page: Page, isSettled: (html: string) => boolean): Promise<string> {
  const read = async (): Promise<string | null> => {
    try {
      return await page.content();
    } catch {
      return null;
    }
  };
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let html = await read();

  while ((html === null || !isSettled(html)) && Date.now() < deadline) {
    await sleep(SETTLE_POLL_MS);
    html = await read();
  }

  return html ?? "";
}

/**
 * Render a page in Obscura and return its HTML.
 *
 * Obscura owns the browser identity, JavaScript execution, page settling,
 * stealth and tracker blocking. Norish adds exactly one thing: the requesting
 * user's Site Auth Tokens, in a context that belongs to this fetch alone.
 *
 * There is no second engine behind this. An empty string means Obscura
 * produced no usable HTML, and the import path reports that as a fetch failure.
 *
 * `isSettled` is the caller's own reading of whether the rendered HTML is the
 * page it asked for. Only a caller knows: a shop's bot check and a shop's
 * empty results page are the same two kilobytes to everyone else. Without it
 * the page is read once, the moment it loads, exactly as before.
 */
export async function fetchRenderedPage(
  targetUrl: string,
  tokens?: SiteAuthTokenDecryptedDto[],
  isSettled?: (html: string) => boolean
): Promise<string> {
  let context: BrowserContext | undefined;

  try {
    const browser = await getBrowser();

    const headerTokens = tokens?.filter((t) => t.type === "header") ?? [];
    const cookieTokens = tokens?.filter((t) => t.type === "cookie") ?? [];

    // A fresh context per fetch: one importer's tokens can never be seen by
    // another's page, and closing it below disposes of the whole session.
    context = await browser.newContext(
      headerTokens.length > 0
        ? {
            extraHTTPHeaders: Object.fromEntries(
              headerTokens.map((token) => [token.name, token.value])
            ),
          }
        : undefined
    );

    if (cookieTokens.length > 0) {
      let domain: string;

      try {
        domain = new URL(targetUrl).hostname;
      } catch {
        domain = targetUrl;
      }
      await context.addCookies(
        cookieTokens.map((token) => ({
          name: token.name,
          value: token.value,
          domain,
          path: "/",
        }))
      );
    }

    const page = await context.newPage();

    await page.goto(targetUrl, {
      waitUntil: "load",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    if (!isSettled) return await page.content();

    return await settledContent(page, isSettled);
  } catch (error) {
    log.warn({ err: error, url: targetUrl }, "Obscura could not render the page");

    return "";
  } finally {
    if (context) {
      await context.close().catch((err) => {
        log.debug({ err }, "Failed to close the Obscura browser context during cleanup");
      });
    }
  }
}
