const RELEASE_VERSION = "0.20.0-beta";
const CACHE_VERSION = `${RELEASE_VERSION}-shell-v2`;
const CACHE_PREFIX = "norish-web";
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const ROUTE_SHELL_CACHE = `${CACHE_PREFIX}-route-shell-${CACHE_VERSION}`;
const RUNTIME_ASSET_CACHE = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([STATIC_CACHE, ROUTE_SHELL_CACHE, RUNTIME_ASSET_CACHE]);
const OFFLINE_FALLBACK = "/offline.html";
const OFFLINE_SHELL_BOOTSTRAP_MARKER = "data-norish-offline-shell-bootstrap";
const OFFLINE_SHELL_HYDRATED_ATTRIBUTE = "data-norish-offline-shell-hydrated";
const OFFLINE_SHELL_PATHS = new Set(["/", "/calendar", "/groceries"]);
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

  if (url.origin !== self.location.origin || !OFFLINE_SHELL_PATHS.has(url.pathname) || url.search) {
    return null;
  }

  url.hash = "";

  return url.href;
}

function isRuntimeHydrationAssetUrl(value) {
  const url = new URL(value, self.location.origin);

  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/_next/static/") &&
    /\.(?:css|js)$/i.test(url.pathname)
  );
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

async function fetchRequired(request) {
  const response = await fetch(request);

  if (!response.ok) {
    throw new Error(`Offline shell preparation failed with HTTP ${response.status}`);
  }

  return response;
}

async function confirmRouteShell(message) {
  const routeUrl = canonicalRouteUrl(message.route);

  if (!routeUrl) throw new Error("Offline shell route is not supported");

  const routeRequest = new Request(routeUrl, {
    credentials: "same-origin",
    headers: { accept: "text/html" },
  });
  const routeResponse = await fetchRequired(routeRequest);
  const assetUrls = runtimeAssetsReferencedByHtml(await routeResponse.clone().text());
  const assetRequests = assetUrls.map(
    (assetUrl) => new Request(assetUrl, { credentials: "same-origin" })
  );
  const assetResponses = await Promise.all(assetRequests.map(fetchRequired));
  const [shellCache, runtimeCache] = await Promise.all([
    caches.open(ROUTE_SHELL_CACHE),
    caches.open(RUNTIME_ASSET_CACHE),
  ]);

  await Promise.all(
    assetUrls.map((assetUrl, index) => runtimeCache.put(assetUrl, assetResponses[index].clone()))
  );
  await shellCache.put(new Request(routeUrl), routeResponse);
}

async function matchConfirmedRoute(request) {
  const routeUrl = canonicalRouteUrl(request.url);

  if (!routeUrl) return null;

  const shellCache = await caches.open(ROUTE_SHELL_CACHE);
  const runtimeCache = await caches.open(RUNTIME_ASSET_CACHE);
  const shell = await shellCache.match(new Request(routeUrl));

  if (!shell) return null;

  const assetUrls = runtimeAssetsReferencedByHtml(await shell.clone().text());

  for (const assetUrl of assetUrls) {
    if (!(await runtimeCache.match(assetUrl))) return null;
  }

  return shell;
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
    const response = await fetch(request);

    if (![502, 503, 504].includes(response.status)) return response;
  } catch {
    // A rejected navigation uses the same confirmed-shell policy as a
    // backend-unavailable gateway response.
  }

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

async function runtimeAssetResponse(request) {
  const runtimeCache = await caches.open(RUNTIME_ASSET_CACHE);
  // These entries are exact, versioned Next JS/CSS URLs. Ignore response
  // Vary headers because preparation cannot reproduce browser-managed request
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

  event.waitUntil(confirmRouteShell(event.data));
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
    },
    canonicalRouteUrl,
    isRuntimeHydrationAssetUrl,
    runtimeAssetsReferencedByHtml,
    addColdShellBootstrap,
    matchConfirmedRoute,
    navigationResponse,
    confirmRouteShell,
  };
}
