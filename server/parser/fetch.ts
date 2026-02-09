import type { BrowserContext } from "playwright-core";
import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

import { getBrowser } from "@/server/playwright";
import { parserLogger as log } from "@/server/logger";

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

export async function fetchViaPlaywright(
  targetUrl: string,
  tokens?: SiteAuthTokenDecryptedDto[]
): Promise<string> {
  let context: BrowserContext | undefined;

  try {
    const browser = await getBrowser();
    const referer = getReferer(targetUrl);

    // Build extra HTTP headers, merging any user-provided header tokens
    const extraHTTPHeaders: Record<string, string> = {
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
    };

    const headerTokens = tokens?.filter((t) => t.type === "header") ?? [];

    for (const token of headerTokens) {
      extraHTTPHeaders[token.name] = token.value;
    }

    context = await browser.newContext({
      userAgent: BROWSER_HEADERS["User-Agent"],
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      extraHTTPHeaders,
    });

    // Inject cookie-type tokens into the browser context
    const cookieTokens = tokens?.filter((t) => t.type === "cookie") ?? [];

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
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for network to settle, but don't block forever on slow/persistent connections
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
      log.debug({ url: targetUrl }, "Network idle timeout, proceeding with available content");
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

    try {
      await Promise.race([
        page.locator('script[type="application/ld+json"]').first().waitFor({ timeout: 5000 }),
        page.locator('[itemtype*="schema.org"]').first().waitFor({ timeout: 5000 }),
        page
          .locator('main, article, [role="main"], .content, #content')
          .first()
          .waitFor({ timeout: 5000 }),
      ]);
    } catch {
      // Timeout is acceptable - proceed with whatever content we have
      log.debug(
        { url: targetUrl },
        "Recipe content selectors not found within timeout, proceeding anyway"
      );
    }

    return await page.content();
  } catch (error) {
    log.warn({ err: error }, "Playwright fetch failed, Chrome may not be available");

    return ""; // Fallback will use HTTP
  } finally {
    if (context) {
      await context.close().catch((err) => {
        log.debug({ err }, "Failed to close browser context during cleanup");
      });
    }
  }
}
