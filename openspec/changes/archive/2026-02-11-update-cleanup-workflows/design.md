## Context

Current cleanup behavior is split across image-focused functions and daily scheduled jobs. The implementation already removes some orphaned image files and recipe directories, but it does not fully reconcile video files and step image files against all relevant database references. Additionally, cleanup for uploads, calendar retention, and grocery retention is only guaranteed on daily cron execution, not immediately after server startup.

The requested change tightens cleanup semantics around recipe IDs, extends media coverage to videos, and guarantees a one-time cleanup pass during startup.

## Goals / Non-Goals

- Goals:
  - Treat `uploads/recipes/<folder>` as recipe-scoped storage and remove folders that do not map to `recipes.id`.
  - Reconcile recipe media against `recipes`, `recipe_images`, `recipe_videos`, and `step_images` references.
  - Ensure cleanup runs once on startup and continues to run daily.
  - Verify calendar/grocery retention cleanup behavior with test coverage and explicit logging.
  - Add DB integration cleanup tests under `__tests__/server/db/cleanup/` for media-reference reconciliation.
- Non-Goals:
  - Changing retention-period configuration semantics (`SCHEDULER_CLEANUP_MONTHS` remains the source of truth).
  - Introducing new background infrastructure beyond the existing startup flow and scheduled task queue.
  - Backfilling or mutating database rows for media references as part of cleanup.

## Decisions

- Decision: Rename the image cleanup module to media-scoped naming and centralize recipe upload cleanup there.
  - Rationale: The logic now covers image + video + step media, so image-only naming is misleading.

- Decision: Build a referenced-media index from DB first, then sweep disk.
  - Rationale: A DB-first pass allows deterministic keep/delete decisions for each file.
  - Scope of references:
    - Root recipe media: `recipes.image` (thumbnail path), `recipe_images.image`, `recipe_videos.video`
    - Step media: `step_images.image`

- Decision: Keep top-level folder pruning simple.
  - Rationale: User requirement states folder names are recipe IDs; therefore any top-level folder not in `recipes.id` is deleted recursively.

- Decision: Add a dedicated startup maintenance runner and call it from `server.ts` in the same startup phase style as `seedServerConfig` and `migrateGalleryImages`.
  - Rationale: Ensures stale data is cleaned immediately after restart instead of waiting for midnight cron.
  - Execution order target: startup cleanup runs after migrations/config setup and before worker startup / HTTP listen.

- Decision: Keep daily scheduled cleanup jobs active, but update task naming/logging to media scope.
  - Rationale: Startup run is a catch-up pass; daily jobs remain the steady-state maintenance mechanism.

## Risks / Trade-offs

- Risk: Aggressive folder pruning could delete manually placed files not referenced in DB.
  - Mitigation: This is intentional per requirement; logs should include deletion counts and error details.

- Risk: Startup cleanup increases boot time on large upload directories.
  - Mitigation: Use a single DB fetch pass, iterate directories once, and keep logic bounded to recipe root + `steps/` subdir.

- Risk: URL parsing mismatches could incorrectly classify files.
  - Mitigation: Add targeted tests for valid/invalid image/video/step URL patterns and reconciliation decisions.

## Migration Plan

1. Introduce media-scoped cleanup module name and update imports.
2. Extend reconciliation logic for videos + step images and enforce top-level folder pruning.
3. Update scheduled task wiring to media cleanup naming and handlers.
4. Add startup maintenance runner invocation in `server.ts`.
5. Add test coverage for media cleanup behavior and retention cleanup validation.

## Open Questions

- None for proposal scope.
