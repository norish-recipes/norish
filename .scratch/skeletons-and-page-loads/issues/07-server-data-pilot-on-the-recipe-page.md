# 07: Server-data pilot on the recipe page

**What to build:** On a full load of a recipe page, the first paint is the recipe itself. Adopted only on a measured win.

- The server reads the recipe through the tRPC caller (as `recipes/edit/[id]` does) and hands it to the browser's query cache with `HydrationBoundary`. The page still reads only from the query cache (ADR-0001).
- **Cache first in the app:** an in-app navigation renders from the browser cache when it holds the recipe, and the skeleton otherwise. The server's data streams and never holds a navigation up.
- The server's copy counts as fresh: no extra fetch on mount. Recovery's startup refetch still reconciles it.
- An account switch clears the service worker's page and RSC caches too, since documents now carry recipe data (ADR-0005).

See `.scratch/skeletons-and-page-loads/spec.md`, The server-data pilot.

**Blocked by:** 01 and 06 (the baseline is taken after both), 03 (the recipe skeleton it falls back to).

**Status:** done (adopted)

- [x] Baseline: the median time until the recipe's title and ingredients are on screen, using 06's method. Also an in-app tap on an uncached recipe. Recorded here.
- [x] Variant: the same two numbers, recorded here.
- [x] **Decision.** Adopt only if the cold-load median improves by more than the baseline's run-to-run spread and the in-app tap is no slower. Otherwise revert, record the numbers, and close 08.
- [x] If adopted:
  - [x] `first-paint.e2e.ts`: a recipe page's server markup (JavaScript disabled) carries the title; its header comment is updated.
  - [x] A new E2E in the offline project: a cached recipe page is gone after another account signs in on the same browser.
  - [ ] The whole E2E suite passes against a fresh `pnpm build`. Run on 2026-10-15 against a fresh build of the checkout: everything passes except `calendar-planning.e2e.ts:73`, whose navbar Calendar link sits outside the viewport (auto-hidden). The checkout's uncommitted view-transition work changes the navbar's auto-hide; nothing here touches the dashboard, calendar or navbar, and it fails the same way with only 06 and 07 built.
  - [x] A release-notes line under Fixes and Improvements with the measured gain.

## Comments

- 2026-10-15, **adopted.**
  - **Method.** 06's harness on the build with 01 and 06 landed: Pixel 7, CPU ×4, 1.6 / 0.75 Mbps, service worker blocked, one warm-up and the median of 15. "Content" is the first frame in which the recipe's title and an ingredient row are both visible (a MutationObserver plus the next animation frame, never before first paint). The tap opens the dashboard, holds back every `recipes.get` request until the dashboard has settled (the Cache Warmer and the cards' viewport prefetch would otherwise cache all eight dev recipes), then taps the recipe's card.

    | Median (ms)                                | Baseline              | Variant            |
    | ------------------------------------------ | --------------------- | ------------------ |
    | Cold load, title and ingredients on screen | 6,859 (6,820–6,912)   | 844 (828–880)      |
    | First paint of that load                   | 740                   | 844                |
    | In-app tap on an uncached recipe           | 1,129 (1,090–1,229)   | 1,149 (1,107–1,287, one 8.7 s outlier) |

  - **Decision.** Cold load improved by 6 s against a 92 ms spread. The tap is 20 ms slower at the median, inside the baseline's own 139 ms spread, and its code path is unchanged: a navigation's RSC payload carries no recipe (240 bytes). First paint is about 100 ms later because the document is 7.5 KB gzip larger, but that first paint is the recipe.
  - **How it is built.**
    - `recipes/[id]/layout.tsx` (a server layout, so `page.tsx` and the offline shell stay untouched) wraps the page in `QuerySeed` (`components/query-seed.tsx`, shared with 08), which reads the recipe through the tRPC caller into a per-request `QueryClient` and hands it over with `HydrationBoundary`. It always renders the boundary, so a refresh keeps the tree.
    - **A full load waits for the read; a navigation never does.** The layout awaits the recipe (about 40 ms of database time, well inside the time the document itself takes to arrive), so the HTML carries it. The spec asked for streaming so the server's data never holds a navigation up; navigations meet that by skipping the read entirely.
    - **Only document loads are seeded.** Next 16 hides its own RSC headers (`rsc`, `next-router-state-tree`) from `headers()`, so a first attempt that tested `rsc` seeded every navigation and prefetch too. The layout reads the browser's `Sec-Fetch-Dest: document` instead; a request without it gets nothing, as before.
    - The server's copy is not refetched on mount. `QuerySeedBoundary` notes, in memory for this page load, the data each seeded query arrived with, and the global `refetchOnMount` is `false` while a query still holds exactly that data, `"always"` otherwise. The mark holds only while the copy is under the 5-minute stale time, so an old document the service worker serves past the Reachability Deadline, or a router-cache replay, refetches as before, and it clears with the cache on an account switch or reset. (A first version made `recipes.get` refetch only when stale; the E2E run showed a restored Offline Cache copy then skipped its refresh, see 08.) The spec's safety net, "Recovery's startup refetch", doesn't exist: startup Recovery refetches only when Replay sent something, which is why the mark is bounded.
    - **Found on the way:** the browser's query client is a module singleton, and the SSR pass used it too. Seeding it would have left one reader's recipe for the next request, so the server now builds a client per render.
    - An account switch, sign-out or reset now also drops Serwist's `pages`, `pages-rsc` and `pages-rsc-prefetch` caches beside the image cache (ADR-0005).
  - **SSR of the page itself.** This is the first time the recipe page's content renders on the server. Checked in a browser on phone and desktop: no hydration mismatch, no page errors, a missing recipe still shows the 404 view. With JavaScript disabled, the skeleton stays on screen and the recipe sits in the streamed, hidden markup: React swaps it in with an inline script.
