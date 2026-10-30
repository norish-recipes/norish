# 33 — Warm set without query-core internals

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

`promote()` in `apps/web/lib/query-cache/warm-set.ts:247` lengthens the `gcTime` of a query that is already cached. It does this by calling query-core's `protected` `updateGcTime` and `scheduleGc`.

- Before this branch, it called them as `query.updateGcTime()`, and `noCheck` hid the type error.
- Ticket 25 surfaced the error, and the branch switched to bracket access (`query["updateGcTime"]`). That gets past the type error without fixing it.
- In the same file there are 15 `queryClient.fetchQuery(withWarmGcTime(...) as never)` casts. They predate the branch and are the same kind of escape.

**The fix:**

- Give the warm queries their lifetime through the public API, so nothing has to be re-armed afterwards.
- The candidate is `queryClient.setQueryDefaults(<key prefix>, { gcTime: CACHE_MAX_AGE_MS })` for the warm-set keys. With it, the page's own query is created with the warm lifetime and `promote()` goes away.
- Type `withWarmGcTime` so that `fetchQuery` accepts what it returns without `as never`. Since ca13f7e8 (ticket 08), tRPC and TanStack Query are on one line.

## Acceptance criteria

- [x] `warm-set.ts` has no bracket access to query-core and no `as never`.
- [x] A test shows that a recipe and a cookbook the reader opened stay cached past the default `gcTime`.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14: Done. `createQueryClient` in `persisted-query-client.ts` registers `setQueryDefaults([["recipes", "get"]])` and `[["cookbooks", "get"]]` with `gcTime: CACHE_MAX_AGE_MS`, before any read or restore, so the page's own query and a create's seed are built with the warm lifetime. `promote()`, `promoteCreatedRecipe`/`promoteCreatedCookbook` and their call sites are gone, along with the shared-react seams that only carried them (`onRecipeCreated` on `useRecipesMutations`, `usePromoteCreatedCookbook` on the cookbook hooks). `createWarmSet` takes the real `TRPCOptionsProxy<AppRouter>`, so the hand-written `WarmSetTRPC` interface, the `as never` casts and the result casts are gone; its test runs the real options proxy over a link that answers from fixtures, and checks everything warmed is held at the warm lifetime. The acceptance test is in `persisted-query-client.test.ts`: real tRPC keys, a page opens and leaves, the clock passes the 10-minute default, the recipe and cookbook remain and a groceries read is collected. ADR-0008's consequences now name the defaults.
  - Decision: the defaults cover only `recipes.get` and `cookbooks.get`, not every procedure the Warm Set reads. Procedure-wide defaults on `library.list`, `cookbooks.list` and `calendar.listItems` would hold every search, filter and scrolled range for seven days; the Warm Set's own reads keep their lifetime through `withWarmGcTime`, which is public API and now typed without casts.
