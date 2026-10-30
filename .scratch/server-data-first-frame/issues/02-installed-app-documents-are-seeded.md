# 02: Installed-app documents are seeded

**What to build:** A page the installed app loads through its service worker carries the same seed as a browser tab.

- `QuerySeed` seeds only when the request says `Sec-Fetch-Dest: document` (`components/query-seed.tsx:29`). The service worker answers navigations network-first with navigation preload (`app/sw.ts:117,137`). Find out what the server sees for a preload request and for the worker's own fetch, in Chromium and Safari.
- If either arrives without it, the seed must still run for a navigation, for example on the `Service-Worker-Navigation-Preload` header or a header the worker adds, without seeding the RSC and prefetch requests it skips today.

**Blocked by:** 01 (the service-worker-allowed baseline).

**Status:** done

- [x] What each path sends, recorded here.
- [x] If a path wasn't seeded: the fix, and an E2E with `serviceWorkers: "allow"` that a reload after install carries a recipe in the server's markup.
- [x] 01's harness, service worker allowed: before and after (with preload off, the path the fix changes; with preload on nothing changed, see 01's baseline).

## Comments

- 2026-10-16, **navigation preload was seeded; the worker's own fetch was not.**
  - **What the server sees.** A logging proxy in front of the production build, the worker installed and in control, then a navigation to a recipe, then a reload with navigation preload turned off (`registration.navigationPreload.disable()`), which makes the worker fetch the document itself:

    WebKit here is Playwright's build, not Safari on iOS; an installed iOS app wasn't checked.

    | Path                     | Chromium                                                                      | WebKit (Playwright) |
    | ------------------------ | ----------------------------------------------------------------------------- | ------------------- |
    | Navigation preload       | `Sec-Fetch-Dest: document`, `Sec-Fetch-Mode: navigate`, `Service-Worker-Navigation-Preload: true`: seeded | the same |
    | The worker's own `fetch` | `Sec-Fetch-Dest: empty`, `Sec-Fetch-Mode: same-origin`: not seeded            | the same            |

    Both browsers had preload on once the worker was active. The own-fetch path is the one taken wherever `preloadResponse` is empty: preload not supported or not yet enabled.
  - **The fix.** The worker's own fetch adds `norish-document: 1` (`lib/document-request.ts`, `app/sw.ts`), and `QuerySeed` seeds a request that says `Sec-Fetch-Dest: document` or carries it. Only the document strategy adds it, so the RSC and prefetch requests stay unseeded.
  - `first-paint.e2e.ts` installs the worker, turns navigation preload off and reloads a recipe: the response comes from the worker and carries the recipe.
  - **Measured with the harness's `--sw fetch`** (worker installed, preload off; recipe page, ms): avatar 379 (324–472) → 161 (159–196), title 738 (658–850) → 592 (311–617). The title still lands after first paint (160 ms) because the page paints from the precached stylesheet before the recipe's part of the document has streamed in.
