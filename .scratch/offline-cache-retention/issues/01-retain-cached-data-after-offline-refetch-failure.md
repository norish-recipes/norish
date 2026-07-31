# Retain cached data after an Offline refetch failure

Status: ready-for-agent
Blocked by: None

## Problem

On iOS Safari and installed PWAs, Offline data is progressively lost after navigating between routes or cold-launching the app. The failure is intermittent in desktop browsers but reproducible when Safari is terminated on an iOS Simulator:

- Groceries that were warmed and previously rendered can remain on the loading skeleton.
- Planned recipes can disappear from Calendar or fail to open from a plan.
- Some recipe details disappear while others remain, and the dashboard can report an empty catalogue.
- The cached user profile can disappear from the navbar.
- A queued grocery toggle can visually revert to its previous value after navigation.

This is not primarily a Serwist app-shell cache-busting problem. A stronger cache buster would discard the personalized data more often and would not address the observed loss.

## Diagnosis

The persisted TanStack Query client currently dehydrates only queries whose state is `status === "success"` in `apps/web/lib/query-cache/persisted-query-client.ts`.

TanStack Query retains the last successful `data` when a background refetch fails, but changes the query status to `error`. The next persistence event serializes the whole query cache and excludes that errored query. The valid Offline copy is therefore removed from IndexedDB. Repeated Offline navigation can progressively erase independent query families, including groceries, calendar ranges, recipe lists/details, and the user profile.

Evidence gathered on an iPhone 16e Simulator running iOS 26.2:

1. Warmed production data while the backend was Live.
2. Terminated Safari, stopped the backend, and cold-launched Norish.
3. Recipes and a calendar item restored, but Groceries remained on its skeleton.
4. Restarting the backend loaded Groceries. Stopping the backend without terminating Safari still rendered the in-memory grocery data.
5. After an Offline refetch and another Safari termination, Groceries failed again.
6. Safari's `norish-offline` IndexedDB query-cache record contained recipe and calendar query keys but no `groceries.list` key.
7. A focused unit experiment reproduced the mechanism: cached grocery data remained in the live QueryClient after a rejected refetch but was absent from the persisted client.

## Implementation plan

1. Add a regression test around `createCacheManager` that seeds successful query data, performs a failing background refetch, waits for persistence, restores into a new QueryClient, and proves the last successful data remains.
2. Change the dehydration eligibility rule so a failed refetch cannot remove a query that still contains usable previously successful data. Keep never-successful pending/error queries out of the persisted read cache.
3. Verify the rule for representative grocery, calendar, recipe list/detail, and user queries; avoid route-specific exceptions.
4. Exercise a queued grocery toggle across navigation and an Offline cold launch. If it still reverts after cached reads are retained, record that as a separate outbox/optimistic-reconciliation bug rather than expanding this ticket into an outbox redesign.
5. Run the focused unit suite and the existing Offline browser E2E suite, then run the iOS cold-launch acceptance flow below against a production build.

## Acceptance criteria

- [x] A failed background refetch does not remove previously successful query data from the persisted client.
- [x] Queries that have never produced usable data are not persisted merely because they reached an error state.
- [x] After warming while Live, Groceries survives Offline navigation, Safari termination, and a direct cold launch to `/groceries`.
- [x] Planned calendar entries and their recipe details survive the same Offline cold-launch flow.
- [x] The recipe dashboard and representative warmed recipe details remain available after repeated Offline route changes and two consecutive cold launches.
- [x] The last-known user identity/profile remains available Offline under the existing owner-scoping rules.
- [x] A queued grocery toggle does not revert during navigation or cold launch; if it does, a separate agent-ready issue captures the remaining outbox reconciliation failure. — it does revert; captured in `.scratch/offline-cache-retention/issues/02-queued-grocery-toggle-reverts-across-offline-navigation.md`.
- [x] Existing owner isolation, cache reset, max-age, and cache-buster tests continue to pass.
- [x] Focused unit tests, Offline browser E2E, and the iOS Simulator acceptance flow are reported explicitly as passed, failed, or blocked.

## Reproduction seam

The diagnosis used an isolated production E2E server on `http://localhost:3100` with the seeded account `offline-a@norish.test`. A temporary external loop terminated Mobile Safari, opened `/groceries`, waited five seconds, captured a Simulator screenshot, and failed unless OCR found the seeded grocery `Warm Set Oat Milk`. Run the equivalent flow from a clean test profile; do not commit credentials or Simulator-specific paths.

## Non-goals

- Changing the Serwist cache buster or service-worker shell strategy without separate evidence.
- Redesigning the Outbox or optimistic mutation model as part of the read-cache fix.
- Broadening the Warm Set beyond the existing product promises.

## Comments

- 2026-07-24: Reproduced on iOS Simulator after Safari process termination. Desktop Firefox network throttling did not reliably expose the bug because it does not exercise the same mobile cold-start lifecycle.
- 2026-07-28: Verification run against a clean production build (`build:web` + `build:server`).
  - Focused unit suite — **passed**. `apps/web/__tests__/lib/query-cache/persisted-query-client.test.ts`, 13/13, including the two new cases.
  - Offline browser E2E — **passed**. `pnpm --filter @norish/web run test:e2e`, 8/8 in 36.3s, owner isolation, cache reset, max-age and cache-buster cases included.
  - iOS Simulator acceptance flow — **passed for every read-cache criterion**. iPhone 16e, iOS 26.2, Mobile Safari against the production bundle on `http://localhost:3100` as `offline-a@norish.test`: warmed while Live, stopped the backend, forced failing refetches across `/groceries`, `/calendar`, `/` and the warmed recipe detail, then terminated Safari. Groceries, the calendar note, the warmed recipe detail, the dashboard catalogue and the `Offline A` profile chip all survived four Safari terminations, including two consecutive cold launches.
  - The queued grocery toggle — **failed**, and is now issue 02. The Outbox entry itself survives and replays correctly on reconnect (`is_done` became true in Postgres), so this is a read-view reconciliation gap, not data loss.
