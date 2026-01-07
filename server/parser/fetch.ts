import type { Page, BrowserContext } from "playwright-core";

import { getBrowser } from "@/server/playwright";
import { parserLogger as log } from "@/server/logger";
import { getProviderForUrl, type PageProvider } from "@/server/parser/providers";

/**
 * Result from fetching a page via Playwright
 * Includes the HTML content and optionally the page/context for later extraction
 */
export interface FetchResult {
  /** Full HTML content from page.content() */
  html: string;
  /** Playwright Page object (kept open for provider extraction) */
  page?: Page;
  /** Matched provider for this URL (if any) */
  provider?: PageProvider;
  /** Browser context (must be closed by caller) */
  context?: BrowserContext;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9,nl;q=0.8",
  "Cache-Control": "max-age=0",
  "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  DNT: "1",
  Connection: "keep-alive",
};

function getReferer(url: string): string {
  try {
    const parsed = new URL(url);

    return Math.random() > 0.5 ? `https://${parsed.hostname}/` : "https://www.google.com/";
  } catch {
    return "https://www.google.com/";
  }
}

/**
 * Default wait strategy for recipe content
 * Waits for any of: JSON-LD, microdata, or main content areas
 */
function defaultWaitStrategy(page: Page): Promise<void> {
  return Promise.race([
    page.locator('script[type="application/ld+json"]').first().waitFor({ timeout: 5000 }),
    page.locator('[itemtype*="schema.org"]').first().waitFor({ timeout: 5000 }),
    page
      .locator('main, article, [role="main"], .content, #content')
      .first()
      .waitFor({ timeout: 5000 }),
  ]);
}

/**
 * Use provider-specific wait strategy if available
 * Falls back to default strategy if provider doesn't implement getContentSelectors
 */
async function providerWaitForContent(page: Page, provider: PageProvider): Promise<void> {
  if (provider.getContentSelectors) {
    const { selectors, timeout = 5000 } = provider.getContentSelectors();

    await Promise.race(selectors.map((s) => page.locator(s).first().waitFor({ timeout })));
  } else {
    // Fallback to default wait strategy if provider doesn't specify selectors
    await defaultWaitStrategy(page);
  }
}

export async function fetchViaPlaywright(targetUrl: string): Promise<FetchResult> {
  try {
    const browser = await getBrowser();
    const referer = getReferer(targetUrl);
    const context = await browser.newContext({
      userAgent: BROWSER_HEADERS["User-Agent"],
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      extraHTTPHeaders: {
        "Accept-Language": BROWSER_HEADERS["Accept-Language"],
        "Cache-Control": BROWSER_HEADERS["Cache-Control"],
        "Sec-Ch-Ua": BROWSER_HEADERS["Sec-Ch-Ua"],
        "Sec-Ch-Ua-Mobile": BROWSER_HEADERS["Sec-Ch-Ua-Mobile"],
        "Sec-Ch-Ua-Platform": BROWSER_HEADERS["Sec-Ch-Ua-Platform"],
        "Sec-Fetch-Dest": BROWSER_HEADERS["Sec-Fetch-Dest"],
        "Sec-Fetch-Mode": BROWSER_HEADERS["Sec-Fetch-Mode"],
        "Sec-Fetch-Site": BROWSER_HEADERS["Sec-Fetch-Site"],
        "Sec-Fetch-User": BROWSER_HEADERS["Sec-Fetch-User"],
        "Upgrade-Insecure-Requests": BROWSER_HEADERS["Upgrade-Insecure-Requests"],
        Referer: referer,
        DNT: BROWSER_HEADERS["DNT"],
      },
    });

    const page = await context.newPage();

    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    const title = await page.title();
    const hasChallengeElement = (await page.locator("#challenge-running").count()) > 0;
    const isChallenging = title.includes("Just a moment") || hasChallengeElement;

    if (isChallenging) {
      log.debug({ url: targetUrl }, "Cloudflare challenge detected, waiting for resolution");
      await page
        .waitForFunction(() => !document.title.includes("Just a moment"), { timeout: 15000 })
        .catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    // Get provider for this URL
    const provider = getProviderForUrl(targetUrl);

    if (provider) {
      log.debug({ url: targetUrl, provider: provider.name }, "Matched provider for URL");
    } else {
      log.debug({ url: targetUrl }, "No specific provider matched, using default wait strategy");
    }

    // Wait for content to load using provider or default strategy
    try {
      if (provider) {
        await providerWaitForContent(page, provider);
        log.debug(
          { url: targetUrl, provider: provider.name },
          "Provider wait strategy completed successfully"
        );
      } else {
        await defaultWaitStrategy(page);
        log.debug({ url: targetUrl }, "Default wait strategy completed successfully");
      }
    } catch (error) {
      // Timeout is acceptable - proceed with whatever content we have
      log.debug(
        { url: targetUrl, err: error, provider: provider?.name },
        "Wait strategy timed out, proceeding with current page content"
      );
    }

    const content = await page.content();

    // Return page and context for potential later extraction
    // IMPORTANT: Caller must close context when done
    return {
      html: content,
      page,
      provider: provider ?? undefined,
      context,
    };
  } catch (error) {
    log.warn({ err: error }, "Playwright fetch failed, Chrome may not be available");

    return { html: "" }; // Fallback will use HTTP
  }
}

// Keep backwards compatibility alias
export const fetchViaPuppeteer = fetchViaPlaywright;
