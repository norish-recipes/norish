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

## Acceptance criteria

- [ ] A grocery toggled while the backend is down still renders as done after navigating away and
      back, with the backend still down.
- [ ] It still renders as done after Mobile Safari is terminated and cold-launched to `/groceries`,
      backend still down.
- [ ] The queued entry replays exactly once when the backend returns — no double toggle, no
      resurrection of an entry the user has since undone.
- [ ] A regression test fails before the fix and passes after it, at a seam that actually reproduces
      the revert; if the desktop browser suite cannot, say so explicitly and cover it where it can be
      covered.
- [ ] The read-retention behaviour from issue 01 is unchanged, and the existing Offline browser E2E
      and query-cache unit suites stay green.
- [ ] Verification is reported explicitly as passed, failed, or blocked, including a re-run of the
      iOS Simulator flow above.

## Non-goals

- Redesigning the Outbox or the optimistic mutation model.
- Revisiting the dehydration rule shipped in issue 01.
- Broadening this beyond groceries unless the diagnosis shows the same seam affects calendar or
  recipe mutations, in which case note it rather than fixing it here.

## Comments

- 2026-07-28: Split out of issue 01 after the iOS acceptance flow. Issue 01's read-cache criteria all
  passed on the same run; this was the only criterion that failed.
