const CACHE_VERSION = "0.20.0-beta";
const CACHE_PREFIX = "norish-web";
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const ROUTE_SHELL_CACHE = `${CACHE_PREFIX}-route-shell-${CACHE_VERSION}`;
const RUNTIME_ASSET_CACHE = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const STAGING_CACHE = `${CACHE_PREFIX}-staging-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([
  STATIC_CACHE,
  ROUTE_SHELL_CACHE,
  RUNTIME_ASSET_CACHE,
  STAGING_CACHE,
]);
const OFFLINE_FALLBACK = "/offline.html";
const OFFLINE_SHELL_BOOTSTRAP_MARKER = "data-norish-offline-shell-bootstrap";
const OFFLINE_SHELL_HYDRATED_ATTRIBUTE = "data-norish-offline-shell-hydrated";
const STATIC_ASSETS = [
  OFFLINE_FALLBACK,
  "/site.webmanifest",
  "/favicon.svg",
  "/favicon.ico",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
  "/apple-touch-icon.png",
];

function canonicalRouteUrl(value) {
  const url = new URL(value, self.location.origin);

  if (url.origin !== self.location.origin) return null;

  url.hash = "";

  return url.href;
}

function isRuntimeAssetUrl(value) {
  const url = new URL(value, self.location.origin);

  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

function isRuntimeHydrationAssetUrl(value) {
  if (!isRuntimeAssetUrl(value)) return false;

  return /\.(?:css|js)$/i.test(new URL(value, self.location.origin).pathname);
}

function readTagAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function runtimeAssetsReferencedByHtml(html) {
  const values = new Set();
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const isScript = /^<script\b/i.test(tag);
    const rel = readTagAttribute(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    const as = readTagAttribute(tag, "as")?.toLowerCase();
    const referencesRuntime =
      isScript ||
      rel.includes("stylesheet") ||
      rel.includes("modulepreload") ||
      (rel.includes("preload") && (as === "script" || as === "style"));

    if (!referencesRuntime) continue;

    const value = readTagAttribute(tag, isScript ? "src" : "href");

    if (value && isRuntimeHydrationAssetUrl(value)) {
      values.add(new URL(value, self.location.origin).href);
    }
  }

  const embeddedAssetPattern = /(?:https?:\/\/[^"'<>\\\s]+)?\/_next\/static\/[^"'<>\\\s]+/gi;

  for (const match of html.matchAll(embeddedAssetPattern)) {
    const value = match[0].replaceAll("&amp;", "&");

    if (!isRuntimeHydrationAssetUrl(value)) continue;

    const url = new URL(value, self.location.origin);

    values.add(url.href);
  }

  return [...values];
}

function manifestRequest(routeUrl) {
  return new Request(
    `${self.location.origin}/__norish/offline-shell-manifest?route=${encodeURIComponent(routeUrl)}`
  );
}

function stageRequest(value, stageId, index) {
  const url = new URL(`${self.location.origin}/__norish/offline-stage`);

  url.searchParams.set("id", stageId);
  url.searchParams.set("index", String(index));
  url.searchParams.set("source", value);

  return new Request(url);
}

async function fetchRequired(request) {
  const response = await fetch(request);

  if (!response.ok) {
    throw new Error(`Offline shell staging failed with HTTP ${response.status}`);
  }

  return response;
}

async function restoreCacheEntry(cache, request, previous) {
  if (previous) await cache.put(request, previous);
  else await cache.delete(request);
}

async function publishStagedRoute(routeUrl, assetUrls, staged) {
  const shellCache = await caches.open(ROUTE_SHELL_CACHE);
  const runtimeCache = await caches.open(RUNTIME_ASSET_CACHE);
  const routeRequest = new Request(routeUrl);
  const routeManifestRequest = manifestRequest(routeUrl);
  const previousShell = await shellCache.match(routeRequest);
  const previousManifest = await shellCache.match(routeManifestRequest);
  const previousAssets = new Map();

  for (const assetUrl of assetUrls) {
    previousAssets.set(assetUrl, await runtimeCache.match(assetUrl));
  }

  try {
    for (let index = 0; index < assetUrls.length; index += 1) {
      await runtimeCache.put(assetUrls[index], staged[index + 1].clone());
    }

    await shellCache.put(routeRequest, staged[0].clone());
    await shellCache.put(
      routeManifestRequest,
      new Response(JSON.stringify({ routeUrl, assetUrls }), {
        headers: { "content-type": "application/json" },
      })
    );
  } catch (error) {
    await restoreCacheEntry(shellCache, routeRequest, previousShell);
    await restoreCacheEntry(shellCache, routeManifestRequest, previousManifest);

    for (const assetUrl of assetUrls) {
      await restoreCacheEntry(runtimeCache, assetUrl, previousAssets.get(assetUrl));
    }

    throw error;
  }
}

async function stageConfirmedRoute(message) {
  const routeUrl = canonicalRouteUrl(message.route);

  if (!routeUrl) throw new Error("Offline route must be same-origin");

  const observedAssetUrls = [...new Set(Array.isArray(message.assets) ? message.assets : [])]
    .filter(isRuntimeHydrationAssetUrl)
    .map((value) => new URL(value, self.location.origin).href);
  const routeRequest = new Request(routeUrl, {
    credentials: "same-origin",
    headers: { accept: "text/html" },
  });
  const routeResponse = await fetchRequired(routeRequest);
  const shellAssetUrls = runtimeAssetsReferencedByHtml(await routeResponse.clone().text());
  const assetUrls = [...new Set([...observedAssetUrls, ...shellAssetUrls])];
  const assetRequests = assetUrls.map(
    (assetUrl) => new Request(assetUrl, { credentials: "same-origin" })
  );
  const responses = [routeResponse, ...(await Promise.all(assetRequests.map(fetchRequired)))];
  const stageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const stagingCache = await caches.open(STAGING_CACHE);
  const stagingRequests = [routeUrl, ...assetUrls].map((value, index) =>
    stageRequest(value, stageId, index)
  );

  try {
    for (let index = 0; index < responses.length; index += 1) {
      await stagingCache.put(stagingRequests[index], responses[index].clone());
    }

    const staged = await Promise.all(
      stagingRequests.map(async (request) => {
        const response = await stagingCache.match(request);

        if (!response) throw new Error("Offline shell staging verification failed");

        return response;
      })
    );

    await publishStagedRoute(routeUrl, assetUrls, staged);
  } finally {
    await Promise.all(stagingRequests.map((request) => stagingCache.delete(request)));
  }
}

async function matchConfirmedRoute(request) {
  const routeUrl = canonicalRouteUrl(request.url);

  if (!routeUrl) return null;

  const shellCache = await caches.open(ROUTE_SHELL_CACHE);
  const runtimeCache = await caches.open(RUNTIME_ASSET_CACHE);
  const manifest = await shellCache.match(manifestRequest(routeUrl));

  if (!manifest) return null;

  let assetUrls;

  try {
    const value = await manifest.json();

    assetUrls = Array.isArray(value.assetUrls) ? value.assetUrls : [];
  } catch {
    return null;
  }

  for (const assetUrl of assetUrls) {
    if (!(await runtimeCache.match(assetUrl))) return null;
  }

  return (await shellCache.match(new Request(routeUrl))) ?? null;
}

async function addColdShellBootstrap(response) {
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const html = await response.text();

  if (html.includes(OFFLINE_SHELL_BOOTSTRAP_MARKER)) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const bootstrap = `(()=>{const key="norish:web-offline-shell-reload:"+location.pathname+location.search;const hydrated=()=>document.documentElement.getAttribute("${OFFLINE_SHELL_HYDRATED_ATTRIBUTE}")==="true";const reload=()=>{if(hydrated()){try{sessionStorage.removeItem(key)}catch{}return}if(navigator.onLine)return;if(!navigator.serviceWorker.controller){navigator.serviceWorker.addEventListener("controllerchange",reload,{once:true});return}try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1")}catch{return}location.reload()};setTimeout(reload,500)})()`;
  const onload = bootstrap.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const document = html.replace(
    /<body\b/i,
    (body) => `${body} ${OFFLINE_SHELL_BOOTSTRAP_MARKER} onload="${onload}"`
  );
  const headers = new Headers(response.headers);

  headers.delete("content-length");

  return new Response(document, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function navigationResponse(request) {
  try {
    return await fetch(request);
  } catch {
    const shell = await matchConfirmedRoute(request);

    if (shell) return addColdShellBootstrap(shell);

    const staticCache = await caches.open(STATIC_CACHE);

    return (
      (await staticCache.match(OFFLINE_FALLBACK)) ??
      new Response("Norish is offline. Open this route online before using it offline.", {
        headers: { "content-type": "text/plain; charset=utf-8" },
        status: 503,
      })
    );
  }
}

async function runtimeAssetResponse(request) {
  const runtimeCache = await caches.open(RUNTIME_ASSET_CACHE);
  // These entries are exact, versioned Next JS/CSS URLs. Ignore response
  // Vary headers because staging cannot reproduce browser-managed request
  // headers such as Accept-Encoding on a later cold navigation.
  const cached = await runtimeCache.match(request, { ignoreVary: true });

  if (cached) return cached;

  try {
    return await fetch(request);
  } catch {
    return new Response("Offline runtime asset unavailable", { status: 503 });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          const isOldNorishCache =
            key.startsWith("norish-cache-") || key.startsWith(`${CACHE_PREFIX}-`);

          return isOldNorishCache && !CURRENT_CACHES.has(key)
            ? caches.delete(key)
            : Promise.resolve(false);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CONFIRM_ROUTE_SHELL") return;

  event.waitUntil(stageConfirmedRoute(event.data));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(navigationResponse(request));

    return;
  }

  if (isRuntimeHydrationAssetUrl(url.href)) {
    event.respondWith(runtimeAssetResponse(request));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) return client.focus();
      }

      return self.clients.openWindow("/");
    })
  );
});

if (self.__NORISH_SW_TESTING__) {
  self.__NORISH_SW_INTERNALS__ = {
    cacheNames: {
      static: STATIC_CACHE,
      routeShell: ROUTE_SHELL_CACHE,
      runtime: RUNTIME_ASSET_CACHE,
      staging: STAGING_CACHE,
    },
    canonicalRouteUrl,
    isRuntimeAssetUrl,
    isRuntimeHydrationAssetUrl,
    runtimeAssetsReferencedByHtml,
    addColdShellBootstrap,
    matchConfirmedRoute,
    navigationResponse,
    stageConfirmedRoute,
  };
}
