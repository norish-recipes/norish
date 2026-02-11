## 1. Media Cleanup Refactor

- [x] 1.1 Rename `server/startup/image-cleanup.ts` to a media-scoped module name and update all imports (`server/queue/scheduled-tasks/worker.ts`, `server/trpc/routers/user/user.ts`, tests).
- [x] 1.2 Update cleanup logic to load referenced URLs from `recipes.image` (thumbnail path), `recipe_images.image`, `recipe_videos.video`, and `step_images.image`.
- [x] 1.3 Implement top-level `uploads/recipes/` directory pruning: delete any directory not present in `recipes.id`.
- [x] 1.4 Reconcile root recipe files (image/video) and delete files not referenced by the DB URL sets.
- [x] 1.5 Reconcile `uploads/recipes/{recipeId}/steps/` files and delete step images not referenced by `step_images.image`.

## 2. Scheduling and Startup Execution

- [x] 2.1 Update scheduled task queue/producer/worker naming and handlers from image-scoped cleanup to media-scoped cleanup while keeping daily midnight cadence.
- [x] 2.2 Create a dedicated startup cleanup runner module (same startup-script pattern as `seedServerConfig`/`migrateGalleryImages`).
- [x] 2.3 Wire startup runner into `server.ts` so media + calendar + groceries cleanup executes once during startup before workers/listening.

## 3. Retention Validation

- [x] 3.1 Add/expand tests for `cleanupOldCalendarData()` cutoff logic using `SCHEDULER_CLEANUP_MONTHS`.
- [x] 3.2 Add/expand tests for `cleanupOldGroceries()` cutoff logic and recurring-item exclusion.
- [x] 3.3 Add DB integration cleanup tests under `__tests__/server/db/cleanup/` covering reconciliation of `recipes.image` (thumbnail), `recipe_images.image`, `recipe_videos.video`, and `step_images.image`.
- [x] 3.4 Ensure startup cleanup runner surfaces deletion summaries for media/calendar/groceries in logs.

## 4. Verification

- [x] 4.1 Run targeted cleanup tests (media cleanup + scheduler retention + startup runner).
- [x] 4.2 Run project verification commands required for backend changes (`pnpm lint`, `pnpm test:run`).
- [x] 4.3 Run `openspec validate update-cleanup-workflows --strict --no-interactive`.
