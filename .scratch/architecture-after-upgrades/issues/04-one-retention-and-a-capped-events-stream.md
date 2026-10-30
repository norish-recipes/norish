# 04: One retention, and a capped events stream

**What to build:**

- Redis memory stays bounded however many progress updates jobs write, so a large ingredient round can no longer grow a queue's events stream to hundreds of megabytes.
- The job retention an administrator sets is the only retention in effect. The per-queue values that looked in force but never were are gone.

See `.scratch/architecture-after-upgrades/spec.md`, Background jobs, Retention.

**Blocked by:** 01 (with the lazy manager's private `Queue` gone, nothing resets the stream cap in a queue's metadata)

**Status:** ready-for-agent

- [x] The shared queue options set `streams.events.maxLen` to about 1000.
- [x] Each queue's events stream is trimmed to the cap once at boot.
- [x] The per-queue `removeOnComplete`/`removeOnFail` defaults are deleted. The admin retention setting is applied to every queue as today.
- [x] A real-Redis test writes more progress updates than the cap and finds the events stream at or under it. It connects through the production connection options and the shared Redis image constant from the sweep's ticket 34.
- [x] A test proves a queue's effective retention equals the admin setting, CalDAV included.
- [x] Record in this ticket the events stream lengths on the prod copy before and after a boot.

## Comments

- 2026-10-14, implemented:
  - **One place builds every queue.** The registry builds all sixteen from one `queueOptions(jobOptions, removal)`: the shared connection, the queue's job defaults with the administrator's retention, and `streams.events.maxLen: 1000` (`EVENTS_MAX_LEN`). The fifteen one-function `*/queue.ts` factory files are deleted. `scheduled-tasks/queue.ts` keeps its task list and types, and the `createXQueue` re-exports are gone from `@norish/queue`, which nothing imported.
  - **The boot trim.** `initializeQueues` runs `trimEvents(1000)` on every queue. A failure is logged and boot goes on. BullMQ's trim is approximate, and so is the `XADD MAXLEN ~` its scripts do, so a stream settles within one Redis stream node (100 entries) of the cap. The test asserts that, not an exact 1000.
  - **One exception to "the only retention".** Image imports keep their one-hour ceiling on completed jobs, because those jobs carry their images as base64; this guards Redis memory. Unlike the deleted per-queue values, it always applied, since it was computed after the administrator's retention. Everything else is now exactly the administrator's setting.
  - **Tests.**
    - `events-stream-redis.test.ts`: 3,000 progress writes under BullMQ's old default leave more than 2,000 entries, a registry boot cuts them to the cap, and 3,000 more writes through a registry queue stay at the cap.
    - `registry.test.ts`: every queue's `removeOnComplete` and `removeOnFail` equal the administrator's setting, CalDAV included (with the image-import age ceiling), and every queue carries the events cap.
    - `queue-errors.test.ts`: every queue the registry builds logs its `error`.
  - **The prod copy's Redis** (`norish-prod-copy-redis`, started for this and stopped again). The registry's boot step was run against it through a throwaway tsx probe; the full server was not booted, so the copy's Postgres was not migrated.
    - Before: `bull:ingredient-review:events` 680 entries (30 MB), `bull:scheduled-tasks:events` 411, no other streams, and every queue's meta at `opts.maxLenEvents` 10000.
    - After: both streams are unchanged, since both are under the cap, and every queue's meta reads 1000.
    - The 850 MB stream from the September ingredient round is no longer in this copy.
- 2026-10-15, from the branch review: one entry per queue. `QUEUE_SETTINGS: Record<QueueName, …>` replaces the three per-queue maps and the 16 job-option constants (`maxCompletedAgeSeconds` replaces `capImageImportAge`), and the registry builds, finds and closes queues from one table.
- 2026-10-15, the maintainer: image imports take the administrator's retention too, so `maxCompletedAgeSeconds` is gone. A finished image import empties its base64 images from the job data instead, so the retention cannot hold them in Redis. The boot-time trim of the events stream is gone as well: the queue's metadata carries the new cap from boot, and BullMQ cuts the stream to it at the next event.
