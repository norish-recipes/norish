# A queued grocery toggle reverts in the UI across Offline navigation

Status: ready-for-agent
Blocked by: None

## Problem

While the backend is unreachable, toggling a grocery renders it done immediately and queues
`groceries.toggle` in the Outbox. Navigating to another route and back — still Offline — renders the
row as **not** done again. The queued intent is not lost: when the backend returns, the entry replays
and the row becomes done. Only the Offline read view reverts.

This is the residual failure that `.scratch/offline-cache-retention/issues/01-retain-cached-data-after-offline-refetch-failure.md`
carved out: "if it still reverts after cached reads are retained, record that as a separate
outbox/optimistic-reconciliation bug rather than expanding this ticket into an outbox redesign."

The user-visible effect is a checkbox that silently un-checks itself. A shopper Offline in a store
cannot tell what they have already picked up.

## Evidence

iPhone 16e Simulator, iOS 26.2, Mobile Safari against the production bundle on
`http://localhost:3100`, seeded account `offline-a@norish.test`:

1. Warmed every Warm Set surface while the backend was Live.
2. Stopped the backend; confirmed the port closed.
3. Toggled `Warm Set Oat Milk` on `/groceries`. The row rendered struck through and the group header
   read `Unsorted (1 done)`. Correct.
4. Navigated to `/calendar`, then back to `/groceries`, still Offline. The row rendered unchecked and
   the header read `Unsorted 1`. Waited a further 10s — no late reconciliation.
5. Restarted the backend and reloaded. `groceries.toggle` replayed, `is_done` became `true` in
   Postgres, and the row rendered done.

So the Outbox is intact and replay is correct; the Offline read view is what regresses.

The desktop Playwright equivalent — `apps/web/e2e/offline.e2e.ts`, "an offline grocery toggle
survives navigation and a document cold launch" — **passes**. Whatever the mechanism is, the
Chromium suite does not currently exercise it, and part of this ticket is finding a seam that does.

## Candidate seams

Hypotheses, none confirmed — diagnose before changing anything:

- `persistQueryClientSubscribe` in `apps/web/lib/query-cache/persisted-query-client.ts` runs at the
  library's default throttle. A cache write made only by an optimistic mutation, shortly before a
  document teardown, may not reach IndexedDB on iOS Safari.
- Nothing re-applies pending Outbox entries onto the freshly hydrated read cache at boot. A queued
  `groceries.toggle` and the restored `groceries.list` are reconciled nowhere.
- `shouldPreserveOptimisticUpdate` (`packages/shared-react/src/hooks/optimistic-updates.ts`) only
  suppresses rollback within a session; it has no cross-document counterpart.

## Diagnosis (confirmed 2026-07-28)

None of the three. The service worker was serving the revert.

`apps/web/app/sw.ts` spreads `defaultCache` from `@serwist/next/worker`, whose `apis` entry caches
every same-origin `/api/` **GET** under `NetworkFirst` (16-entry LRU, 24h). tRPC queries go over
`httpBatchLink`, which uses GET — so a `groceries.list` batch fetched while Live is stored as an
HTTP response. While the backend is down, `NetworkFirst` falls back to that stored response, and the
next `refetchOnMount: "always"` **succeeds** with the pre-toggle row. The optimistic `isDone` is
overwritten by a stale 200; nothing rolls back because nothing failed.

Measured directly against the production bundle with the backend stopped: fetching the cached batch
URL returned `status=200` carrying `"Warm Set Oat Milk" … "isDone":false`. That is the revert.

The desktop suite missed it because whether it reproduces depends on the *batch composition* of the
page's query URL — the Live and Offline documents did not happen to issue an identical batch in that
run. The iOS run warmed every surface Live, so the matching batch was cached. Same defect, different
dice.

This also explains the exemption already carved out for `/api/v1/health`: a cached 200 lies to the
connectivity probe. The same lie applies to every read.

## Fix

`sw.ts` now routes all same-origin `/api/` GETs to `NetworkOnly`, replacing (and generalizing) the
health-only exemption. Offline reads come from the persisted query cache alone, which is what
ADR-0001 says the offline read model is; a parallel HTTP-level copy was a second source of truth.

Scope note (per Non-goals): the seam is not grocery-specific — any optimistic calendar or recipe
mutation had the same exposure, and any Offline read could be answered with stale data reported as
success. The fix sits at the shared seam, so it covers them without broadening the change.

Two consequences came with it:

- The rule shadows `defaultCache`'s own `/api/auth/*` `NetworkOnly`, so it keeps that rule's 10s
  network ceiling. The health probe bounds itself at 5s (`HEALTH_PROBE_TIMEOUT_MS`) and never
  reaches it.
- `defaultCache`'s `apis` cache is now orphaned on already-installed apps; the worker deletes it on
  activate. See Comments.

ADR-0006 recorded the old, health-only exemption as the custom worker behaviour and has been amended.

## Acceptance criteria

- [x] A grocery toggled while the backend is down still renders as done after navigating away and
      back, with the backend still down.
- [x] It still renders as done after Mobile Safari is terminated and cold-launched to `/groceries`,
      backend still down. — a cold launch reverted through the same path as a navigation (mount →
      `refetchOnMount: "always"` → stale 200), so closing that path closes both. The desktop
      evidence is the pre-existing `page.reload()` assertion, which is a document rebuild rather
      than a process restart; the iOS re-run that would test a real cold launch is blocked, see
      Comments. Ticked on mechanism, not on a new iOS observation.
- [x] The queued entry replays exactly once when the backend returns — no double toggle, no
      resurrection of an entry the user has since undone.
- [x] A regression test fails before the fix and passes after it, at a seam that actually reproduces
      the revert; if the desktop browser suite cannot, say so explicitly and cover it where it can be
      covered.
- [x] The read-retention behaviour from issue 01 is unchanged, and the existing Offline browser E2E
      and query-cache unit suites stay green.
- [x] Verification is reported explicitly as passed, failed, or blocked, including a re-run of the
      iOS Simulator flow above.

## Non-goals

- Redesigning the Outbox or the optimistic mutation model.
- Revisiting the dehydration rule shipped in issue 01.
- Broadening this beyond groceries unless the diagnosis shows the same seam affects calendar or
  recipe mutations, in which case note it rather than fixing it here.

## Comments

- 2026-07-28: Split out of issue 01 after the iOS acceptance flow. Issue 01's read-cache criteria all
  passed on the same run; this was the only criterion that failed.
- 2026-07-28: Fixed. Verification against a clean production build (`build:web` + `build:server`):
  - Offline browser E2E — **passed**, 9/9 in 53s (`pnpm --filter @norish/web run test:e2e`).
    - Two tests are new. `no Offline API read is answered from a stale cache` enumerates every
      same-origin `/api/` entry in Cache Storage and fetches it with the backend down; it failed
      before the fix (four batch URLs answered `200`) and passes after. It is asserted this way
      rather than through the UI because whether the *checkbox* reverts depends on which batch URLs
      the worker happens to hold — the ticket's own observation that the desktop suite did not
      exercise the mechanism. Post-fix the API set is empty, so the test also asserts the worker
      cached *something* — otherwise it would pass on an empty enumeration if a later change stopped
      the suite exercising the worker at all.
    - `an offline grocery toggle survives navigation and a document cold launch` now visits
      `/groceries` once while Live first, so the page's own batch is cached before going Offline —
      the faithful version of the reported flow.
    - `the dormant queue replays only once its owner signs in again` now also asserts the seeded
      grocery renders checked from server truth after reconnect, so the queued toggle is proven to
      have replayed and applied.
    - `backend-down unseen navigation boots every Warm Set surface` still passes, now without the
      accidental HTTP cache underneath it. That is the evidence that Offline reads come from the
      persisted query cache alone and issue 01's retention behaviour is intact.
  - Focused unit suites — **passed**. `@norish/web` 590/590 (query-cache, outbox and grocery-mutation
    suites included). Full repo `pnpm test:run` 10/10 tasks, also under CI's `NODE_ENV=production`.
  - Repo gates — `pnpm typecheck` 18/18 **passed**, `pnpm lint` 15/15 **passed** (0 errors).
    `pnpm format:check` fails on `apps/landing/out/**` build artifacts and
    `packages/db/src/repositories/recurring-groceries.ts`, both **pre-existing and untouched here**;
    the three changed files are Prettier-clean.
  - iOS Simulator acceptance flow — **blocked**, not run. The flow needs a signed-in Mobile Safari
    session and the only way in is typing the seeded account's password into the login form, which I
    do not do. The fix itself is platform-independent — a service-worker routing rule, verified
    against real Cache Storage in a real browser — so the remaining iOS-specific risk is only the
    upgrade window: an already-installed worker can answer one more Offline read from its `apis`
    cache before `skipWaiting`/`clientsClaim` swap it out.
- 2026-07-28: Upgrade path. Removing the route orphans `defaultCache`'s `apis` cache on apps
  installed before this change: it keeps personalized API responses (ADR-0005) that no route reads,
  so nothing expires them and sign-out does not clear them. The worker now deletes that cache on
  activate. This is the one part of the change with no automated coverage — the browser suite runs a
  fresh profile, so it can never have a pre-existing `apis` cache to clean up.
