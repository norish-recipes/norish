import type { Page } from "playwright-core";

/**
 * Configuration for content selectors
 * Used for both waiting for content and extracting focused content
 */
export interface ContentSelectors {
  /** Priority-ordered selectors to try */
  selectors: string[];
  /** Timeout in milliseconds for each selector (default: 5000) */
  timeout?: number;
}

/**
 * Result from URL normalization
 */
export interface NormalizeUrlResult {
  /** The normalized URL (with tracking params removed, etc.) */
  url: string;
  /** If true, indicates the URL should be re-fetched with the normalized version */
  shouldRefetch?: boolean;
}

/**
 * Result from redirect detection
 */
export interface RedirectDetectionResult {
  /** The detected redirect target URL */
  redirectUrl: string;
  /** Reason for the redirect (for error messages) */
  reason?: string;
}

/**
 * Interface for website-specific page providers
 * Providers can customize wait strategies and content extraction for specific websites
 */
export interface PageProvider {
  readonly name: string;

  /**
   * Check if this provider handles the given URL
   * Provider is responsible for its own URL/hostname matching logic
   */
  matches(url: string): boolean;

  /**
   * Normalize/clean the URL before fetching
   * Use this to remove tracking parameters, convert mobile URLs, etc.
   * @param url - The original URL
   * @returns Normalized URL result, or null if no normalization needed
   */
  normalizeUrl?(url: string): NormalizeUrlResult | null;

  /**
   * Detect if the page redirects to another recipe URL
   * Use this for aggregator sites or social media bookmarks that link elsewhere
   * @param page - Playwright page object
   * @param url - The URL being fetched
   * @returns Redirect detection result, or null if no redirect detected
   */
  detectRedirect?(page: Page, url: string): Promise<RedirectDetectionResult | null>;

  /**
   * Config-based approach: Return selectors for waiting and extraction
   * These selectors will be used both for waiting during fetch and extracting focused content for AI
   * @returns ContentSelectors configuration, or undefined if using custom extraction
   */
  getContentSelectors?(): ContentSelectors;

  /**
   * Custom extraction function for complex cases
   * Use this when simple selectors aren't enough (e.g., "Jump to Recipe" button detection)
   * @param page - Playwright page object
   * @returns HTML string of extracted content, or null to use full page content
   */
  extractContent?(page: Page): Promise<string | null>;
}

/**
 * Base provider with simple hostname matching
 */
export abstract class BasePageProvider implements PageProvider {
  abstract readonly name: string;
  protected abstract readonly hostnames: string[];

  matches(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      return this.hostnames.some(
        (h) => hostname === h.toLowerCase() || hostname.endsWith("." + h.toLowerCase())
      );
    } catch {
      return false;
    }
  }
}
