/**
 * Cache Storage names shared by the service worker and window-context code.
 *
 * The Cache Warmer writes warmed primary images into the same bounded cache
 * the service worker's image route reads (ADR-0009), so the name must be a
 * single definition both bundles import.
 */
export const IMAGE_CACHE_NAME = "norish-images";
