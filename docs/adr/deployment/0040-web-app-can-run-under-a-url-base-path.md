# The web app can run under a URL base path

A self-hoster often puts Norish behind one reverse proxy that already owns the domain root. Next.js cannot be moved under a prefix by the proxy alone: it emits absolute URLs for its chunks, API, socket and service worker, so a rewrite at the proxy breaks the first asset request. The app must be built for the prefix.

**The prefix is a build-time value, `NEXT_PUBLIC_BASE_PATH`, and its name matches the landing app.** Next.js inlines the value into the client bundles, so one image serves one prefix. The published image stays at the root. An operator who needs a prefix builds the image with `--build-arg NEXT_PUBLIC_BASE_PATH=/norish` and sets `AUTH_URL` to the same prefix. The runtime stage carries the same value, so the server and the client bundles can never disagree.

**Every absolute URL the app emits goes through `addBasePath`.** Next.js applies the prefix to `next/link` and `next/router` itself, and `assetPrefix` covers `/_next`; everything else is explicit: the tRPC HTTP endpoint and socket, the OpenAPI endpoint, the health probe and the Docker healthcheck, the manifest's `start_url`, `scope`, icons and screenshots, the metadata icons and iOS splash images, `next/image` sources, the archive export URL and archive-download claim URL, the login, sign-out, account-deletion and Offline home redirects, the callback defaults, and the custom server's static-file handler, which strips the prefix before it reads `public/`. The helper is idempotent, so a request path that Next.js already prefixed is never prefixed twice.

**The service worker derives its prefix from its own URL.** The worker is served at `${basePath}/serwist/sw.js`, and `self.location.pathname` gives the prefix without relying on an esbuild-inlined environment variable. The registration scope is `${basePath}/`, so an instance under a prefix never controls the proxy's other routes. The `Service-Worker-Allowed` header the route handler already sends is wider than that scope, and the precache entry for the offline shell carries the prefix.

**`AUTH_URL` includes the prefix; `TRUSTED_ORIGINS` stays an origin.** Better Auth builds its callback and sign-in URLs from `AUTH_URL`, and the login redirect uses the same prefix. `TRUSTED_ORIGINS` remains a list of origins because the proxy and the WebSocket compare origins, not paths.

## Considered and rejected

- **A proxy rewrite (`sub_filter`, a location that rewrites paths).** It breaks the first request for a content-hashed chunk, the RSC payloads, the WebSocket path and the worker scope, and it cannot be tested against the real bundle because the paths live in the hashed JavaScript. A deployment that only appears to work is worse than one that asks for a rebuild.
- **A runtime base path.** Next.js requires the value at build time. A runtime value would render links to routes the build never made, and the client and server would disagree about the asset prefix.
- **A separate port or subdomain.** An operator can already do that without a code change. The feature exists for the operator who cannot: the proxy owns 443 and the certificate.
- **Patching `next.config.js` only.** The page would load, and the socket, manifest, worker scope, healthcheck and static handler would stay at the root.
- **A per-request prefix from `X-Forwarded-Prefix`.** The client bundles are static and the prefix is inlined; one server cannot serve two prefixes from one build.

## Consequences

- The published image remains root-only. A prefixed deployment builds its own image, and the documentation and release notes say so.
- The Dockerfile bakes the value into the runtime stage and uses it in the healthcheck.
- The base-path browser E2E project builds with the prefix and proves the shell, assets, manifest, worker scope, tRPC, login and sign-out, the Offline reload and warmed surfaces, and the archive export. It runs only when the build carries the same prefix, so the default suite never runs it against a root build.
- A future CDN or a second prefix is a new build, not a configuration change.
