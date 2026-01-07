import { PageProvider } from "./base";
import { PinterestProvider } from "./pinterest";
import { GenericRecipeProvider } from "./generic-recipe";

/**
 * Registry of all available page providers
 * IMPORTANT: Providers are checked in order - specific providers MUST come before generic ones
 *
 * Order matters:
 * 1. Site-specific providers first (Pinterest, etc.)
 * 2. GenericRecipeProvider MUST be last - it matches ALL URLs as a fallback
 */
const PROVIDERS: PageProvider[] = [
  // Specific providers first (higher priority)
  new PinterestProvider(),

  // Future site-specific providers should go here:
  // new AllRecipesProvider(),
  // new FoodNetworkProvider(),

  // MUST be last: GenericRecipeProvider matches ALL URLs as a universal fallback
  new GenericRecipeProvider(),
];

/**
 * Find a provider that can handle the given URL
 * @param url - The recipe URL to match
 * @returns The first matching provider, or null if none found
 */
export function getProviderForUrl(url: string): PageProvider | null {
  for (const provider of PROVIDERS) {
    if (provider.matches(url)) {
      return provider;
    }
  }

  return null;
}

// Export types for testing and extension
export type {
  PageProvider,
  ContentSelectors,
  NormalizeUrlResult,
  RedirectDetectionResult,
} from "./base";
export { PinterestProvider } from "./pinterest";
export { GenericRecipeProvider } from "./generic-recipe";
