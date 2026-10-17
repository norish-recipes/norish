# 06: The server draws the Library

**What to build:** A full load of `/` shows the reader's recipe cards in the first paint. Adopted only on a measured win, as `.scratch/skeletons-and-page-loads/issues/07-*.md` was.

- **Seeded queries fill during render.** The shell's `RecipesContextProvider` already watches `library.list` above the page, and `HydrationBoundary` fills an existing query only in an effect, so the server would still draw the skeleton. `QuerySeedBoundary` (`components/query-seed-boundary.tsx`) fills a seeded query whose cache entry has no data yet during render. 09 relies on this too.
- **Seed `library.list`** (infinite, the page's own input, under 05's filters) beside the calendar read in `app/(app)/page.tsx`.
- **Rows on the server:** the grid's window virtualiser (`components/dashboard/library-grid.tsx`) gets an `initialRect` from Device Kind, so the server and the hydrating render draw the same first rows; the browser corrects it once it has measured.
- **Bytes:** dashboard rows are an estimated 1–1.5 KB each, so a 100-row first page is 20–35 KB gzip, against 07's 7.5 KB, which cost about 100 ms of first paint. Drop fields no card reads (`notes`, if nothing else reads it) and measure; a smaller seeded page would part from the Warm Set's floor (ADR-0009).

**Blocked by:** 01, 05.

**Status:** done

- [x] 01's harness, `/`: content time, first paint and document size, before and after; the in-app tap no slower. **Decision:** adopt only if content time improves by more than the spread and first paint by no more than the gain is worth; otherwise revert and record the numbers here.
- [x] If adopted: `first-paint.e2e.ts` asserts a recipe card in the server's markup, and a reader who scrolls before hydration sees no blank space past the server's rows (or the ticket records why it doesn't matter).

## Comments

- 2026-10-17, **adopted.**
  - **Seeded queries fill during render.** `QuerySeedBoundary` now hydrates, during render, every seeded query whose cache entry has no data yet (`fillEmptyQueries`), the ones a provider above already watches included; `HydrationBoundary` alone would leave those to an effect. `__tests__/components/query-seed-boundary.test.tsx` renders a watcher above the boundary and a reader below it on the server: red on the old boundary, green now.
  - **The seed.** `app/(app)/page.tsx` reads `library.list` (infinite) beside the calendar, with `libraryListInput(toRecipesQueryFilters(…))` under 05's filters, the same input the shell's `RecipesContextProvider` and the page's `LibraryView` ask with. Without the cookie it reads nothing, and the browser reads its filters after mount as before.
  - **Rows on the server.** `LibraryGrid` gives its window virtualiser `initialRect` from the Device Kind (`DEVICE_KIND_WINDOW` in `hooks/use-viewport.ts`: phone 390×844, desktop 1024×768), so the server and the hydrating render draw the same rows, and the browser measures its own window after.
  - **Scrolling before hydration.** Until it hydrates, the list ends at the server's last row instead of at the full list's height, so a reader who scrolls early reaches the end of what is drawn, never blank rows. After hydration the list takes its full height without moving anything above. `first-paint.e2e.ts` loads `/` with every app script blocked, scrolls to the bottom and finds no gap under the last row.
  - **A hydration mismatch, found and fixed.** The first build threw React #418 on `/` and on a cookbook. On the server, the global `refetchOnMount` answered `"always"` (only the browser marks server copies), so a seeded infinite query rendered as fetching and the grid drew its load-more spinner, which the hydrating render didn't. Paused on React's hydration exception to find the fiber. `refetchOnMount` is now `false` on the server, which never fetches anyway.
  - **Measured** (service worker blocked, median and spread of 15, ms; before is the build with 03 to 05):

    | `/`                    | Before                | After          |
    | ---------------------- | --------------------- | -------------- |
    | first paint            | 616 (596–704)         | 692 (660–772)  |
    | a Library card         | 6,689 (6,627–7,460)   | 692 (660–772)  |
    | a heart on a card      | 6,689 (6,627–7,460)   | 692 (660–772)  |
    | document               | 32.2 KB gzip          | 42.7 KB gzip   |
    | in-app tap to a recipe | 1,209 (1,190–1,306)   | 1,208 (1,190–1,357) |

  - **Decision.** Content arrives 6 s sooner against a spread of about 100 ms. First paint is 76 ms later, the cost of the 10.5 KB of a 100-row first page, and that first paint now is the Library. The tap is unchanged. Adopted.
  - **`notes` stays.** No card reads it, but in the dev database 7 of 480 recipes have notes (about 220 characters each), so dropping it would save around 0.3 KB on a 100-row page: below what the harness can see, for a change to the shared contract and its optimistic copies. The seeded page stays the Warm Set's floor.
