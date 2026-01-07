import type { Page } from "playwright-core";

import { BasePageProvider } from "./base";

import { parserLogger as log } from "@/server/logger";

/**
 * Generic Recipe Provider
 * Implements common recipe site patterns like "Jump to Recipe" buttons
 * Acts as a universal fallback for ALL recipe sites, not just specific domains
 */
export class GenericRecipeProvider extends BasePageProvider {
  readonly name = "generic-recipe";
  protected readonly hostnames: string[] = []; // Override matches() instead

  /**
   * Match ALL URLs as a fallback provider
   * This provider uses common recipe patterns that work across many sites
   * It should be registered LAST in the provider list so specific providers take precedence
   */
  matches(_url: string): boolean {
    // Always return true - this is a catch-all provider
    // Should be registered last in provider list so specific providers match first
    return true;
  }

  async extractContent(page: Page): Promise<string | null> {
    log.debug("GenericRecipeProvider: attempting to extract focused content");

    // Strategy 1: Look for "Jump to Recipe" or "Skip to Recipe" button
    const jumpButtonSelectors = [
      'a:has-text("Jump to Recipe")',
      'a:has-text("Skip to Recipe")',
      'a:has-text("Jump to recipe")',
      'a:has-text("Skip to recipe")',
      'button:has-text("Jump to Recipe")',
      'button:has-text("Skip to Recipe")',
      '[class*="jump"]:has-text("Recipe")',
      '[class*="skip"]:has-text("Recipe")',
    ];

    for (const selector of jumpButtonSelectors) {
      try {
        const jumpButton = page.locator(selector).first();

        if ((await jumpButton.count()) > 0) {
          // Try to get the href target
          const href = await jumpButton.getAttribute("href");

          if (href?.startsWith("#")) {
            const targetId = href.slice(1);
            const target = page.locator(`#${targetId}`);

            if ((await target.count()) > 0) {
              const html = await target.innerHTML();

              log.debug({ targetId }, "Found content via Jump to Recipe button");

              return html;
            }
          }
        }
      } catch {
        // Button not found or navigation failed, try next selector
        continue;
      }
    }

    // Strategy 2: Look for common recipe container patterns
    const containerSelectors = [
      ".recipe-card",
      ".recipe-content",
      '[class*="recipe-container"]',
      '[class*="recipeContainer"]',
      'article[class*="recipe"]',
      '[itemtype*="schema.org/Recipe"]', // Microdata hint
      ".wprm-recipe-container", // WP Recipe Maker plugin
      ".tasty-recipes", // Tasty Recipes plugin
      ".easyrecipe", // Easy Recipe plugin
    ];

    for (const selector of containerSelectors) {
      try {
        const element = page.locator(selector).first();

        if ((await element.count()) > 0) {
          const html = await element.innerHTML();

          log.debug({ selector }, "Found content via container pattern");

          return html;
        }
      } catch {
        // Element not found, try next selector
        continue;
      }
    }

    log.debug("GenericRecipeProvider: no generic patterns matched");

    return null; // No generic pattern found, use full page
  }
}
