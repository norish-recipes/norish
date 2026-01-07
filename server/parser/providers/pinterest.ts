import type { Page } from "playwright-core";

import {
  BasePageProvider,
  type ContentSelectors,
  type NormalizeUrlResult,
  type RedirectDetectionResult,
} from "./base";

import { parserLogger as log } from "@/server/logger";

/**
 * Pinterest Provider
 * Handles URL normalization, redirect detection, and focused extraction for Pinterest
 */
export class PinterestProvider extends BasePageProvider {
  readonly name = "pinterest";
  protected readonly hostnames = ["pinterest.com"];

  /**
   * Normalize Pinterest URLs by removing tracking parameters
   * Example: /pin/123/sent/?invite_code=abc → /pin/123/
   */
  normalizeUrl(url: string): NormalizeUrlResult | null {
    try {
      const parsed = new URL(url);

      // Remove common Pinterest tracking parameters
      const trackingParams = ["invite_code", "sender", "sfo", "invite_sent", "share"];

      trackingParams.forEach((param) => parsed.searchParams.delete(param));

      // Remove /sent/ path component
      let pathname = parsed.pathname;

      if (pathname.includes("/sent/")) {
        pathname = pathname.replace("/sent/", "/");
      }

      // Ensure trailing slash for pin URLs
      if (pathname.match(/^\/pin\/\d+$/) && !pathname.endsWith("/")) {
        pathname += "/";
      }

      parsed.pathname = pathname;

      const normalizedUrl = parsed.toString();

      // Only return if something changed
      if (normalizedUrl !== url) {
        log.debug({ original: url, normalized: normalizedUrl }, "Normalized Pinterest URL");

        return { url: normalizedUrl };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect if Pinterest pin redirects to an external recipe
   * Pinterest includes the original URL in og:see_also meta tag for external links
   */
  async detectRedirect(page: Page, url: string): Promise<RedirectDetectionResult | null> {
    try {
      // Pinterest stores the original external URL in og:see_also meta tag
      // Example: <meta content="https://example.com/recipe" property="og:see_also"/>
      const metaTag = page.locator('meta[property="og:see_also"], meta[name="og:see_also"]');

      if ((await metaTag.count()) > 0) {
        const content = await metaTag.first().getAttribute("content");

        if (content && !content.includes("pinterest.com")) {
          // This is an external link - Pinterest is just a bookmark
          log.info(
            { pinterestUrl: url, targetUrl: content },
            "Detected Pinterest redirect to external recipe via og:see_also"
          );

          return {
            redirectUrl: content,
            reason: "Pinterest pin links to external recipe",
          };
        }
      }

      return null;
    } catch (error) {
      log.warn({ err: error, url }, "Error detecting Pinterest redirect");

      return null;
    }
  }

  getContentSelectors(): ContentSelectors {
    return {
      selectors: [
        // Pinterest recipe container (most specific)
        '[data-test-id="pin-recipe-container"]',
        // Recipe ingredient markers
        '[data-test-id="recipe-ingredient"]',
        // Recipe-related divs (Pinterest often uses generic divs)
        'div[role="article"]',
      ],
      timeout: 5000,
    };
  }
}
