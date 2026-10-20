# 01 — Batch image import

Status: ready-for-human
Blocked by: none

## Image modes

The image dialog in Add Recipe makes one recipe from many images of the same recipe.
The Bulk images page makes one recipe for each image.

## What

Add a bulk image import that makes one recipe per image through the one-image
import pipeline.

## Acceptance

- [x] A separate `/recipes/import` page from the Library header, outside
      the Add Recipe dialog.
- [x] One batch item for each image in order, and one recipe for each image,
      with a batch id.
- [x] At most the image worker's concurrency in flight per batch.
- [x] Per-image status: queued, processing, done, failed.
- [x] One bad image does not stop the batch.
- [x] Retry for failed items that have their bytes.
- [x] MIME and size checks before the bytes are read, plus a total batch
      cap and a per-person open-batch cap.
- [x] Only the person who starts a batch can read or retry it; recipes are
      limited as the one-image import.
- [x] No temporary files; the server removes failed images; the source image of a
      good import stays the recipe's image.
- [x] All translations are complete, and `pnpm i18n:check` passes.
- [x] Playwright AI E2E coverage for a good result, partial failure, and retry.
- [x] Release notes and docs page.

## Limits

- 10 images in one batch.
- 10 MB in one image and 40 MB in one batch, before base64.
- 41 MB in the multipart request body; the HTTP server returns HTTP 413
  from the Content-Length.
- 3 open batches for one person. A queued or processing item, or a failed
  item with its bytes, keeps a batch open. A done batch or a 24-hour expiry
  frees the slot.
- 24 hours for a retryable failed item to keep its bytes.

## Implementation

- Batch state: `packages/queue/src/image-import/batch-store.ts` (Redis, one
  key per item, 24-hour TTL).
- Orchestration: `packages/queue/src/image-import/batch.ts`.
- Worker integration: `packages/queue/src/image-import/worker.ts`.
- API: three procedures in `packages/trpc/src/routers/recipes/recipes.ts`.
- UI: `apps/web/components/import/` and
  `apps/web/app/(app)/recipes/import/page.tsx`.
- Entry point: `apps/web/components/dashboard/dashboard.tsx`.

## Verification

- `pnpm --filter @norish/queue exec vitest run __tests__/image-import`
- `pnpm --filter @norish/queue exec vitest run __tests__/image-import/batch-store.integration.test.ts`
  (CI, or `TEST_REDIS_URL` against a local Redis)
- `pnpm --filter @norish/api exec vitest run __tests__/startup/request-limits.test.ts`
- `pnpm --filter @norish/trpc exec vitest run __tests__/recipes/batch-import.test.ts`
- `pnpm --filter @norish/web exec vitest run __tests__/components/import`
- `pnpm i18n:check`
- `pnpm --filter @norish/web typecheck`

## Status reads

The status query reads the image bytes for each item.
Thus one status read can read 40 MB, and the screen reads it every 2 seconds.
A separate key for the bytes is a follow-up.
