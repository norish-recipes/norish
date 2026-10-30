# 02: BullMQ deduplication replaces the hand-rolled checks

**What to build:**

- A reader who taps import twice on the same URL gets one import.
- Importing it again after the first import has finished runs a new import, whatever the job history keeps.
- A burst of calendar edits reaches the calendar app as one sync, and an edit made while a sync runs is synced right after it.
- Restarting twice in a minute asks for one catalogue refresh.

All three producers use BullMQ's deduplication in one `add`, replacing the check, the removal and the re-read each does by hand today. See `.scratch/architecture-after-upgrades/spec.md`, Background jobs, Deduplication.

**Blocked by:** 01 (the CalDAV debounce needs delayed jobs, which only an always-on worker runs reliably)

**Status:** ready-for-agent

- [x] The boot catalogue ask adds its job with a fixed deduplication id and no longer scans the pending jobs. The next boot after the job finishes asks again.
- [x] Recipe import:
  - [x] Today's deterministic id becomes the deduplication id, with a unique job id.
  - [x] A duplicate is recognised by `add` returning a job whose id differs from the one asked for.
  - [x] The pre-check, the removal of a kept finished job and the race re-read are deleted.
- [x] CalDAV sync adds with a delay of about two seconds and `deduplication: { id, replace: true, keepLastIfActive: true }`. The hand-rolled replace-and-follow-up is deleted.
- [x] Enrichment's producer is unchanged. A comment says why: its status read and automatic-run merging rely on deterministic ids and kept history.
- [x] Real-Redis tests:
  - [x] The same URL imported twice yields one job.
  - [x] Imported again after completion, it yields a second job.
  - [x] Five CalDAV adds within the delay yield one sync.
  - [x] An add while a sync is active yields exactly one follow-up sync.
  - [x] Two boot asks yield one job.
  - [x] Every real-Redis test connects through the production connection options and the shared Redis image constant from the sweep's ticket 34, and adds no `vi.clearAllMocks()` (Vitest 5's default, the sweep's ticket 31).
- [x] Recipe-import and calendar E2E specs pass against a fresh `pnpm build`.

## Comments

- 2026-10-14, implemented:
  - **Recipe import.** The job id is the import's `recipeId`, which the router already generates fresh per request, and the URL's policy-scoped id is the deduplication id. `isJobInQueue` and `removeRetainedTerminalJob` stay in `helpers.ts`, because the image and paste imports and enrichment still use them.
  - **Boot catalogue ask.** Deduplication id `boot-ingredient-catalogue-refresh`, and the pending-jobs scan is gone.
  - **CalDAV sync.** A 2 s delay (`CALDAV_SYNC_DEBOUNCE_MS`) with `{ id, replace: true, keepLastIfActive: true }` and a random job id. The producer now returns nothing, since no caller read the job.
  - **A gap the spec's options leave, closed here.** BullMQ replaces a deduplicated job only while it is delayed, and keeps the last add only while the job is active. A job that is already waiting for the worker therefore swallows a newer add, and its sync pushes the older state.
    - This happens when two items' syncs fall due together. A busy worker promotes no delayed jobs, so they are promoted only when it next takes one, and then all due jobs are promoted at once.
    - When `add` answers with another job's id, the producer now calls `updateData` on that job, which is one call. For a running job this is harmless: its follow-up already carries the same state.
    - It is not atomic with the add. A job the worker takes in between still syncs the older state; a `ponytail:` comment marks this.
    - `caldav-sync-producer.test.ts` has the case, and it fails without the `updateData` call.
  - **Tests.**
    - `__tests__/recipe-import/producer-redis.test.ts`: one import while one is in flight, a new one once it finished, the `exists` answer, and the three view policies. The mock-queue versions of these are gone from `recipe-import-queue.test.ts`.
    - `__tests__/queue/caldav-sync-producer.test.ts`, rewritten against Redis with an always-on worker: a burst gives one sync with the last state, an add during a running sync gives exactly one follow-up with the last state, and a job already waiting syncs the newer state.
    - `scheduled-tasks/producer-redis.test.ts`: two boots ask once, and the next boot after the ask has run asks again.
- 2026-10-14. E2E: the full browser suite passed against a fresh build on 2026-10-14: 181 of 181, no flaky test, the recipe-import and calendar specs among them.
- 2026-10-15, from the branch review:
  - **An edit while the first sync is pending joins it.** The listener skipped a move or rename of an item with no sync row, and the row is written only after the first sync succeeds, so the 2-second delay made the edit easy to lose. It now asks BullMQ's deduplication id whether a sync is pending (`isCaldavSyncPending`) before the row; an item with neither is still skipped.
  - **Image and paste imports deduplicate through BullMQ** like URL imports. `isJobInQueue` is deleted and `generateJobId` is `recipeImportDeduplicationId`; `removeRetainedTerminalJob` stays for enrichment.
- 2026-10-15: **a CalDAV edit merged into a waiting sync is never lost.** BullMQ replaces a deduplicated job only while it is delayed, so an edit arriving once the sync waits for the worker is handed over by `updateData`, which is not atomic with the add. When the worker took the job in between, with the older state, the producer now adds the edit again, and `keepLastIfActive` keeps it as the running job's follow-up. A Redis test reproduces the race.
