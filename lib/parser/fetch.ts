import { getBrowser } from "../playwright";

import { parserLogger as log } from "@/server/logger";

// Common browser headers to avoid bot detection
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

export async function fetchViaPlaywright(targetUrl: string): Promise<string> {
  try {
    const browser = await getBrowser();
    const referer = getReferer(targetUrl);

    // Create a new browser context with anti-fingerprint settings
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

    // Add init script to override navigator properties (equivalent to evaluateOnNewDocument)
    await page.addInitScript(() => {
      // Override the webdriver property
      Object.defineProperty(navigator, "webdriver", { get: () => false });

      // Override plugins to look like a real browser
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en", "nl"],
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;

      window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: "denied" } as PermissionStatus)
          : originalQuery(parameters);
    });

    await page.goto(targetUrl, {
      waitUntil: "networkidle", // Playwright uses "networkidle" (not "networkidle2")
      timeout: 30000,
    });

    // Check for Cloudflare challenge and wait if needed
    const isChallenging = await page.evaluate(() => {
      return (
        document.title.includes("Just a moment") ||
        document.body?.textContent?.includes("Checking your browser") ||
        document.querySelector("#challenge-running") !== null
      );
    });

    if (isChallenging) {
      // Wait for Cloudflare challenge to complete
      await page.waitForURL("**/*", { waitUntil: "networkidle", timeout: 15000 }).catch(() => { });
      // Extra wait for any remaining JS execution
      await page.waitForTimeout(2000);
    }

    // Wait for recipe content to be populated
    const contentLoaded = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const maxWait = 8000;
        const checkInterval = 200;
        let elapsed = 0;

        const checkContent = () => {
          // Check for JSON-LD
          const jsonLd = document.querySelector('script[type="application/ld+json"]');

          if (jsonLd?.textContent?.toLowerCase().includes("recipe")) {
            resolve(true);

            return;
          }

          // Check for populated ingredient/instruction containers
          const ingredientContainers = document.querySelectorAll(
            '.ingredients, .ingredient, [class*="ingredient"], [id*="ingredient"]'
          );
          const instructionContainers = document.querySelectorAll(
            '.steps, .instructions, .directions, [class*="instruction"], [class*="direction"], [class*="step"], [id*="instruction"], [id*="step"]'
          );

          // Check if any container has actual content (not just empty)
          for (const el of ingredientContainers) {
            if (el.textContent && el.textContent.trim().length > 20) {
              resolve(true);

              return;
            }
          }
          for (const el of instructionContainers) {
            if (el.textContent && el.textContent.trim().length > 20) {
              resolve(true);

              return;
            }
          }

          // Check for schema.org microdata
          const schemaRecipe = document.querySelector('[itemtype*="Recipe"]');

          if (schemaRecipe?.textContent && schemaRecipe.textContent.trim().length > 100) {
            resolve(true);

            return;
          }

          elapsed += checkInterval;
          if (elapsed >= maxWait) {
            resolve(false);

            return;
          }

          setTimeout(checkContent, checkInterval);
        };

        checkContent();
      });
    });

    if (!contentLoaded) {
      log.debug({ url: targetUrl }, "Recipe content containers remain empty after waiting");
    }

    const content = await page.content();

    await context.close();

    return content;
  } catch (error) {
    log.warn({ err: error }, "Playwright fetch failed, Chrome may not be available");

    return ""; // Fallback will use HTTP
  }
}

// Keep backwards compatibility alias
export const fetchViaPuppeteer = fetchViaPlaywright;
