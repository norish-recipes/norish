import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

/**
 * The service-worker build, as a Route Handler.
 *
 * Turbopack has no plugin API, so `@serwist/turbopack` replaces the
 * `@serwist/next` webpack plugin with a `force-static` route that esbuild-
 * bundles `app/sw.ts` at prerender time and serves it from `/serwist/sw.js`
 * (ADR-0006 is unchanged — Serwist still owns the worker and its
 * content-hashed precache manifest; only the build seam moved).
 *
 * Registration stays with <RegisterServiceWorker/> — one explicit, logged
 * path — rather than Serwist's `SerwistProvider` window runtime.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    // The native binary rather than esbuild-wasm; @serwist/turbopack only
    // defaults to native on Windows, and the wasm build is markedly slower.
    useNativeEsbuild: true,
    // Precache the offline navigation-fallback document so the SW's
    // `fallbacks` can serve it (ADR-0006). The revision is per-build: the
    // page's HTML references content-hashed chunks, so a stale copy would
    // point at pruned assets.
    manifestTransforms: [
      async (entries) => ({
        manifest: [...entries, { url: "/~offline", revision: randomUUID(), size: 0 }],
        warnings: [],
      }),
    ],
  });
