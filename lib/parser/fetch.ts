import { getBrowser } from "../puppeteer";

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

export async function fetchViaPuppeteer(targetUrl: string): Promise<string> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Stealth: Override navigator properties to avoid detection
    await page.evaluateOnNewDocument(() => {
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

    const referer = getReferer(targetUrl);

    // Set extra HTTP headers before navigation
    await page.setExtraHTTPHeaders({
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
    });

    // Set user agent with client hints metadata (using new API)
    await page.setUserAgent({
      userAgent: BROWSER_HEADERS["User-Agent"],
      userAgentMetadata: {
        brands: [
          { brand: "Google Chrome", version: "131" },
          { brand: "Chromium", version: "131" },
          { brand: "Not_A Brand", version: "24" },
        ],
        fullVersion: "131.0.0.0",
        platform: "Windows",
        platformVersion: "10.0.0",
        architecture: "x86",
        model: "",
        mobile: false,
      },
    });

    // Set viewport to look like a real browser
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(targetUrl, {
      waitUntil: "networkidle2", // Wait for network to be idle (helps with Cloudflare)
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
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
      // Extra wait for any remaining JS execution
      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
      await page.waitForSelector('script[type="application/ld+json"]', {
        timeout: 8000,
      });
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }

    const content = await page.content();

    await page.close();

    return content;
  } catch (error) {
    log.warn({ err: error }, "Puppeteer fetch failed, Chrome may not be available");

    return ""; // Fallback will use HTTP
  }
}

export async function fetchViaHttp(targetUrl: string): Promise<string> {
  const referer = getReferer(targetUrl);

  try {
    const res = await (globalThis as any).fetch(targetUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Referer: referer,
      },
    });

    return !res || !res.ok ? "" : await res.text();
  } catch {
    return "";
  }
}
