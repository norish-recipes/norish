/**
 * The web Cache Warmer's image half: warmed recipes' same-origin primary images go into the
 * bounded cache the service worker's image route reads (ADR-0009).
 */

import {
  IMAGE_CACHE_MAX_AGE_SECONDS,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_NAME,
} from "@/lib/offline/cache-names";
import { CacheExpiration } from "serwist";

import type { WarmedRecipe } from "@norish/shared-react/offline";
import { addBasePath } from "@norish/shared/lib/base-path";

export async function warmPrimaryImages(recipes: WarmedRecipe[]): Promise<boolean> {
  const urls = recipes
    .map((recipe) => sameOriginImageUrl(recipe.image))
    .filter((url): url is string => url !== null);

  if (urls.length === 0) {
    return true;
  }

  if (typeof caches === "undefined" || typeof fetch !== "function") {
    return false;
  }

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const expiration = new CacheExpiration(IMAGE_CACHE_NAME, {
      maxEntries: IMAGE_CACHE_MAX_ENTRIES,
      maxAgeSeconds: IMAGE_CACHE_MAX_AGE_SECONDS,
    });
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          if (await cache.match(url)) {
            await expiration.updateTimestamp(url);

            return true;
          }

          const response = await fetch(url);

          if (!response.ok) {
            return false;
          }

          await cache.put(url, response);
          await expiration.updateTimestamp(url);

          return true;
        } catch {
          return false;
        }
      })
    );

    await expiration.expireEntries();

    return results.every(Boolean);
  } catch {
    return false;
  }
}

function sameOriginImageUrl(image: string | null | undefined): string | null {
  if (!image || typeof location === "undefined") {
    return null;
  }

  try {
    const url = new URL(addBasePath(image), location.href);

    return url.origin === location.origin ? url.toString() : null;
  } catch {
    return null;
  }
}
