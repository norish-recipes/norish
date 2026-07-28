/**
 * Cache Storage names shared by the service worker and window-context code.
 *
 * The Cache Warmer writes warmed primary images into the same bounded cache
 * the service worker's image route reads (ADR-0009), so the name must be a
 * single definition both bundles import.
 */
export const IMAGE_CACHE_NAME = "norish-images";
export const IMAGE_CACHE_MAX_ENTRIES = 512;
export const IMAGE_CACHE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * `defaultCache`'s name for the same-origin `/api/` route the worker no longer
 * has. On an app installed before that change the cache is orphaned — still
 * holding personalized API responses (ADR-0005) that nothing expires and
 * sign-out does not clear — so `app/sw.ts` deletes it on activate.
 */
export const LEGACY_API_CACHE_NAME = "apis";

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
