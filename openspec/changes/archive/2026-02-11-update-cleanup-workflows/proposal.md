# Change: Simplify upload and retention cleanup workflows

## Why

Upload cleanup is currently image-centric and does not fully reconcile recipe videos and step media against database references. Cleanup also runs only on the daily schedule, so stale upload, calendar, and grocery records can remain until midnight after a restart.

## What Changes

- Expand cleanup from image-only behavior to recipe media behavior (thumbnail/gallery images, step images, and recipe videos).
- Delete any directory under `uploads/recipes/` whose folder name is not present in `recipes.id`.
- Remove unreferenced media by reconciling filesystem paths against `recipes.image` (recipe thumbnail path), `recipe_images.image`, `recipe_videos.video`, and `step_images.image`.
- Add a dedicated startup maintenance cleanup runner (same startup pattern as `seedServerConfig` and `migrateGalleryImages`) so cleanup executes once at boot.
- Keep daily scheduled cleanup active and align naming/logging with the broader media scope.
- Validate calendar and grocery retention cleanup behavior against `SCHEDULER_CLEANUP_MONTHS` with explicit test coverage.
- Add database integration cleanup test coverage under `__tests__/server/db/cleanup`.

## Impact

- Affected specs: `recipe-media-cleanup`, `retention-cleanup`, `startup-maintenance`
- Affected code:
  - `server/startup/image-cleanup.ts` (rename and broaden scope)
  - `server/queue/scheduled-tasks/queue.ts`
  - `server/queue/scheduled-tasks/producer.ts`
  - `server/queue/scheduled-tasks/worker.ts`
  - `server.ts` and new startup cleanup runner module
  - `server/scheduler/old-calendar-cleanup.ts`
  - `server/scheduler/old-groceries-cleanup.ts`
  - DB cleanup integration tests under `__tests__/server/db/cleanup/`
  - startup cleanup tests under `__tests__/startup/`
