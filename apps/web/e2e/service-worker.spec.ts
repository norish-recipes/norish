import { expect, test } from "./fixtures";
import { PRIMARY_GROCERY_NAME } from "./support/api";
import { readBrowserReadCache, warmPrimaryReadCache } from "./support/cache";

test("@critical reopens an exact confirmed shell and rejects an unconfirmed route", async ({
  page,
  context,
}) => {
  await warmPrimaryReadCache(page);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (!navigator.serviceWorker.controller) return false;
        const routeCacheName = (await caches.keys()).find((name) =>
          name.startsWith("norish-web-route-shell-")
        );

        if (!routeCacheName) return false;

        return Boolean(await (await caches.open(routeCacheName)).match(location.href));
      })
    )
    .toBe(true);

  const shellAssets = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const routeCacheName = cacheNames.find((name) => name.startsWith("norish-web-route-shell-"));
    const runtimeCacheName = cacheNames.find((name) => name.startsWith("norish-web-runtime-"));

    if (!routeCacheName || !runtimeCacheName) {
      return {
        manifestAssets: [],
        embeddedAssets: [],
        missingAssets: ["required shell cache is missing"],
        missingFromManifest: [],
      };
    }

    const manifestUrl = new URL("/__norish/offline-shell-manifest", location.origin);

    manifestUrl.searchParams.set("route", location.href);
    const routeCache = await caches.open(routeCacheName);
    const manifestResponse = await routeCache.match(manifestUrl.href);
    const manifest = manifestResponse
      ? ((await manifestResponse.json()) as { assetUrls?: string[] })
      : null;
    const manifestAssets = manifest?.assetUrls ?? [];
    const shell = await routeCache.match(location.href);
    const shellHtml = (await shell?.text()) ?? "";
    const embeddedAssets = [
      ...new Set(
        [...shellHtml.matchAll(/(?:https?:\/\/[^"'<>\\\s]+)?\/_next\/static\/[^"'<>\\\s]+/gi)]
          .map((match) => new URL(match[0].replaceAll("&amp;", "&"), location.origin))
          .filter((url) => /\.(?:css|js)$/i.test(url.pathname))
          .map((url) => url.href)
      ),
    ];
    const runtimeCache = await caches.open(runtimeCacheName);
    const missingAssets: string[] = [];

    for (const asset of manifestAssets) {
      if (!(await runtimeCache.match(asset))) missingAssets.push(asset);
    }

    return {
      manifestAssets,
      embeddedAssets,
      missingAssets,
      missingFromManifest: embeddedAssets.filter((asset) => !manifestAssets.includes(asset)),
    };
  });

  expect(shellAssets.manifestAssets.length).toBeGreaterThan(0);
  expect(shellAssets.embeddedAssets.length).toBeGreaterThan(0);
  expect(shellAssets.missingFromManifest).toEqual([]);
  expect(shellAssets.missingAssets).toEqual([]);

  await context.setOffline(true);
  await page.close();
  const offlinePage = await context.newPage();

  await offlinePage.goto("/groceries", { waitUntil: "domcontentloaded" });
  expect(await offlinePage.evaluate(() => navigator.onLine)).toBe(false);
  await expect
    .poll(async () => {
      const snapshot = await readBrowserReadCache(offlinePage);

      return snapshot.scopes.filter((scope) => scope.active).length;
    })
    .toBe(1);
  await expect(offlinePage.getByText(PRIMARY_GROCERY_NAME, { exact: true })).toBeVisible();

  await offlinePage.goto("/recipes/new", { waitUntil: "domcontentloaded" });
  await expect(offlinePage.getByRole("heading", { name: "Norish is offline" })).toBeVisible();
});

test("keeps personalized APIs and generic images out of Cache Storage", async ({ page }) => {
  await warmPrimaryReadCache(page);
  const entries = await page.evaluate(async () => {
    const result: Array<{ cacheName: string; url: string }> = [];

    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) result.push({ cacheName, url: request.url });
    }

    return result;
  });
  const safeStaticImages = new Set([
    "/favicon.svg",
    "/favicon.ico",
    "/web-app-manifest-192x192.png",
    "/web-app-manifest-512x512.png",
    "/apple-touch-icon.png",
  ]);

  expect(entries.some(({ url }) => new URL(url).pathname.startsWith("/api/"))).toBe(false);
  expect(
    entries.some(({ cacheName, url }) => {
      const pathname = new URL(url).pathname;
      const image = /\.(?:avif|gif|jpe?g|png|webp)$/i.test(pathname);

      return image && !cacheName.includes("-static-") && !safeStaticImages.has(pathname);
    })
  ).toBe(false);
});
