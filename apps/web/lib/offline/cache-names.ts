/**
 * Cache Storage names shared by the service worker and window-context code.
 *
 * The Cache Warmer writes warmed primary images into the same bounded cache
 * the service worker's image route reads (ADR-0009), so the name must be a
 * single definition both bundles import.
 */
export const IMAGE_CACHE_NAME = "norish-images";

/**
 * Drop the whole runtime image cache. Cached images are personalized
 * household data (ADR-0005), so account transitions clear them alongside the
 * read cache; entries carry no owner tag, so the unit is the whole cache.
 */
export async function deleteImageCache(): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }

  try {
    await caches.delete(IMAGE_CACHE_NAME);
  } catch {
    // Cache Storage unavailable — nothing personalized is retrievable anyway.
  }
}
