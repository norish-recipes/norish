# 10: Skeletons on every route

**What to build:** Every app route gets a `loading.tsx`, so a tap shows a skeleton at once. Without one, Next prefetches nothing of a dynamic route, and a tap to the Library or Groceries waited for the server.

**Blocked by:** 06.

**Status:** done

- [x] `/`, `/groceries` (and the Pantry below it) and `/share/[token]` have a `loading.tsx`.
- [x] The Library's seed stays read once: the app's providers watch its first page.
- [x] `first-paint.e2e.ts`: a tap to the Library and to Groceries draws with the server's answer held, and a full load of `/` never asks for `library.list`.

## Comments

- 2026-10-17, **done.**
  - `/` moved into a `(library)` route group. Its seed is the group's layout, above the loading boundary, so it fills the cache in the same render as the app's providers (which watch `library.list`); in the page, the boundary would hydrate after them and they would ask again. The page is `<Dashboard />`, the fallback `<Dashboard skeleton />`: the real controls and Today's meals over grey cards, so the grid and its scroll memory mount once.
  - Groceries draws its screen in the layout, which ignores `children`; its `loading.tsx` renders nothing and only lets Next prefetch that layout. The screen draws its own skeleton.
  - A full load now carries the `/` skeleton too (Next streams each segment, so the boundary always waits a moment). Measured on `/` (median of 15, ms): first paint 692 (680–712), document 47.4 KB gzip, against 632 (624–648) and 42.5 KB with no `loading.tsx` on the same build and machine. The maintainer kept the skeleton: about 60 ms for a skeleton on every tap.
