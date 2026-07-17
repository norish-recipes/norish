// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ORIGIN = "https://norish.test";
const source = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/sw.js"),
  "utf8"
);

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return new URL(input, ORIGIN).href;
  if (input instanceof URL) return input.href;

  return input.url;
}

class MemoryCache {
  readonly values = new Map<string, Response>();

  async addAll(values: string[]): Promise<void> {
    for (const value of values) {
      this.values.set(requestUrl(value), new Response(`static:${value}`, { status: 200 }));
    }
  }

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    return this.values.get(requestUrl(input))?.clone();
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    this.values.set(requestUrl(input), response.clone());
  }

  async delete(input: RequestInfo | URL): Promise<boolean> {
    return this.values.delete(requestUrl(input));
  }
}

class MemoryCacheStorage {
  readonly stores = new Map<string, MemoryCache>();

  async open(name: string): Promise<MemoryCache> {
    let cache = this.stores.get(name);

    if (!cache) {
      cache = new MemoryCache();
      this.stores.set(name, cache);
    }

    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }
}

type ServiceWorkerInternals = {
  cacheNames: { static: string; routeShell: string; runtime: string; staging: string };
  canonicalRouteUrl: (value: string) => string | null;
  isRuntimeAssetUrl: (value: string) => boolean;
  isRuntimeHydrationAssetUrl: (value: string) => boolean;
  runtimeAssetsReferencedByHtml: (html: string) => string[];
  addColdShellBootstrap: (response: Response) => Promise<Response>;
  matchConfirmedRoute: (request: Request) => Promise<Response | null>;
  navigationResponse: (request: Request) => Promise<Response>;
  stageConfirmedRoute: (message: { route: string; assets: string[] }) => Promise<void>;
};

function createWorker(fetchImplementation: typeof fetch = vi.fn()) {
  const listeners = new Map<string, (event: any) => void>();
  const cacheStorage = new MemoryCacheStorage();
  const worker = {
    __NORISH_SW_TESTING__: true,
    __NORISH_SW_INTERNALS__: undefined as ServiceWorkerInternals | undefined,
    location: { origin: ORIGIN },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn(),
    },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, listener: (event: any) => void) => {
      listeners.set(type, listener);
    },
  };
  const context = vm.createContext({
    self: worker,
    caches: cacheStorage,
    fetch: fetchImplementation,
    Request,
    Response,
    Headers,
    URL,
    Set,
    Map,
    Promise,
    Math,
    Date,
    Error,
    encodeURIComponent,
  });

  vm.runInContext(source, context);

  return {
    caches: cacheStorage,
    internals: worker.__NORISH_SW_INTERNALS__!,
    listeners,
    worker,
  };
}

async function dispatchWaitUntil(
  listener: ((event: any) => void) | undefined,
  event: Record<string, unknown> = {}
): Promise<void> {
  let pending: Promise<unknown> = Promise.resolve();

  listener?.({
    ...event,
    waitUntil: (value: Promise<unknown>) => {
      pending = value;
    },
  });
  await pending;
}

describe("service worker offline shell policy", () => {
  it("precaches a deterministic fallback and safe assets without precaching root", async () => {
    const worker = createWorker();

    await dispatchWaitUntil(worker.listeners.get("install"));
    const staticCache = await worker.caches.open(worker.internals.cacheNames.static);

    expect(await staticCache.match(`${ORIGIN}/offline.html`)).toBeDefined();
    expect(await staticCache.match(`${ORIGIN}/site.webmanifest`)).toBeDefined();
    expect(await staticCache.match(`${ORIGIN}/`)).toBeUndefined();
    expect(worker.worker.skipWaiting).toHaveBeenCalledOnce();
  });

  it("stages only referenced same-origin Next assets and matches route shells exactly", async () => {
    const network = vi.fn<typeof fetch>(async (input) => {
      const url = requestUrl(input);

      return new Response(url.includes("/_next/static/") ? "runtime" : "shell", { status: 200 });
    });
    const worker = createWorker(network);

    await worker.internals.stageConfirmedRoute({
      route: "/recipes/one?tab=steps",
      assets: [
        `${ORIGIN}/_next/static/chunks/app.js`,
        `${ORIGIN}/api/trpc/recipes.list`,
        "https://other.test/_next/static/foreign.js",
        `${ORIGIN}/recipe.jpg`,
      ],
    });

    const exact = await worker.internals.matchConfirmedRoute(
      new Request(`${ORIGIN}/recipes/one?tab=steps`)
    );
    const differentSearch = await worker.internals.matchConfirmedRoute(
      new Request(`${ORIGIN}/recipes/one?tab=ingredients`)
    );
    const runtimeCache = await worker.caches.open(worker.internals.cacheNames.runtime);

    expect(await exact?.text()).toBe("shell");
    expect(differentSearch).toBeNull();
    expect(await runtimeCache.match(`${ORIGIN}/_next/static/chunks/app.js`)).toBeDefined();
    expect(await runtimeCache.match(`${ORIGIN}/api/trpc/recipes.list`)).toBeUndefined();
    expect(await runtimeCache.match(`${ORIGIN}/recipe.jpg`)).toBeUndefined();
  });

  it("derives required route scripts and styles from the fetched shell HTML", async () => {
    const shell = `<!doctype html>
      <link rel="stylesheet" href="/_next/static/css/route.css">
      <link rel="preload" as="font" href="/_next/static/media/font.woff2">
      <script src="/_next/static/chunks/route.js"></script>
      <script>self.__next_f.push([1, "embedded:/_next/static/chunks/segment.js"])</script>
      <img src="/_next/static/media/photo.png">`;
    const network = vi.fn<typeof fetch>(async (input) => {
      const url = requestUrl(input);

      return new Response(url.includes("/_next/static/") ? `runtime:${url}` : shell, {
        status: 200,
      });
    });
    const worker = createWorker(network);

    await worker.internals.stageConfirmedRoute({ route: "/groceries", assets: [] });
    const runtimeCache = await worker.caches.open(worker.internals.cacheNames.runtime);

    expect(await runtimeCache.match(`${ORIGIN}/_next/static/css/route.css`)).toBeDefined();
    expect(await runtimeCache.match(`${ORIGIN}/_next/static/chunks/route.js`)).toBeDefined();
    expect(await runtimeCache.match(`${ORIGIN}/_next/static/chunks/segment.js`)).toBeDefined();
    expect(await runtimeCache.match(`${ORIGIN}/_next/static/media/font.woff2`)).toBeUndefined();
    expect(await runtimeCache.match(`${ORIGIN}/_next/static/media/photo.png`)).toBeUndefined();
  });

  it("preserves the previous exact shell when a required asset cannot be staged", async () => {
    let failAsset = false;
    const network = vi.fn<typeof fetch>(async (input) => {
      const url = requestUrl(input);

      if (failAsset && url.includes("broken.js")) return new Response("broken", { status: 503 });

      return new Response(failAsset ? "new shell" : "old shell", { status: 200 });
    });
    const worker = createWorker(network);
    const route = "/recipes/preserved";

    await worker.internals.stageConfirmedRoute({ route, assets: [] });
    failAsset = true;
    await expect(
      worker.internals.stageConfirmedRoute({
        route,
        assets: [`${ORIGIN}/_next/static/chunks/broken.js`],
      })
    ).rejects.toThrow("staging failed");

    expect(
      await (await worker.internals.matchConfirmedRoute(new Request(`${ORIGIN}${route}`)))?.text()
    ).toBe("old shell");
  });

  it("uses an exact shell offline and returns the first-ever fallback for unconfirmed routes", async () => {
    let online = true;
    const network = vi.fn<typeof fetch>(async (input) => {
      if (!online) throw new TypeError("Failed to fetch");

      return new Response(`network:${requestUrl(input)}`, { status: 200 });
    });
    const worker = createWorker(network);

    await dispatchWaitUntil(worker.listeners.get("install"));
    await worker.internals.stageConfirmedRoute({ route: "/calendar", assets: [] });
    online = false;

    expect(
      await (await worker.internals.navigationResponse(new Request(`${ORIGIN}/calendar`))).text()
    ).toContain("network:https://norish.test/calendar");
    expect(
      await (
        await worker.internals.navigationResponse(new Request(`${ORIGIN}/never-opened`))
      ).text()
    ).toBe("static:/offline.html");
  });

  it("adds a one-shot hydration bootstrap only to cached HTML shells", async () => {
    const worker = createWorker();
    const shell = await worker.internals.addColdShellBootstrap(
      new Response("<html><head></head><body>shell</body></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );
    const text = await shell.text();

    expect(text).toContain("data-norish-offline-shell-bootstrap");
    expect(text).toContain("data-norish-offline-shell-hydrated");
    expect(text).toContain("<body data-norish-offline-shell-bootstrap onload=");
    expect(text).not.toContain("<script data-norish-offline-shell-bootstrap");
  });

  it("intercepts Next hydration assets regardless of destination without intercepting APIs or images", () => {
    const worker = createWorker();
    const fetchListener = worker.listeners.get("fetch")!;
    const apiRespond = vi.fn();
    const imageRespond = vi.fn();
    const chunkRespond = vi.fn();

    fetchListener({
      request: {
        method: "GET",
        url: `${ORIGIN}/api/trpc/recipes.list`,
        mode: "cors",
        destination: "",
      },
      respondWith: apiRespond,
    });
    fetchListener({
      request: { method: "GET", url: `${ORIGIN}/recipe.jpg`, mode: "cors", destination: "image" },
      respondWith: imageRespond,
    });
    fetchListener({
      request: {
        method: "GET",
        url: `${ORIGIN}/_next/static/chunks/segment.js`,
        mode: "cors",
        destination: "",
      },
      respondWith: chunkRespond,
    });

    expect(apiRespond).not.toHaveBeenCalled();
    expect(imageRespond).not.toHaveBeenCalled();
    expect(chunkRespond).toHaveBeenCalledOnce();
  });

  it("deletes legacy and old-version Norish caches without touching current or unrelated caches", async () => {
    const worker = createWorker();

    await worker.caches.open("norish-cache-v0.3.0-beta");
    await worker.caches.open("norish-web-route-shell-old");
    await worker.caches.open("another-app-cache");
    for (const current of Object.values(worker.internals.cacheNames)) {
      await worker.caches.open(current);
    }

    await dispatchWaitUntil(worker.listeners.get("activate"));
    const keys = await worker.caches.keys();

    expect(keys).not.toContain("norish-cache-v0.3.0-beta");
    expect(keys).not.toContain("norish-web-route-shell-old");
    expect(keys).toContain("another-app-cache");
    expect(keys).toEqual(expect.arrayContaining(Object.values(worker.internals.cacheNames)));
    expect(worker.worker.clients.claim).toHaveBeenCalledOnce();
  });
});
