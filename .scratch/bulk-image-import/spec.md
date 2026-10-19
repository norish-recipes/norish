# Bulk image import

## Problem

A person can import only one recipe at a time from images.
The **Add Recipe => Image** dialog uses all the images as images of one recipe.
A person with ten recipe images must open the dialog ten times.

The one-image import already does the work:
it queues one job, reads the image with a vision model, makes the recipe,
stores the source image, and reports the new recipe.

## Goal

Let a signed-in person select many images at one time and get one recipe for each image.
The batch must continue when one image fails.
It must show the result for each image and let the person retry a failed image.

## Scope

In range:

- A separate entry point and screen for bulk image import.
- A batch layer over the image-import queue, worker, and extraction handler.
- Status for each image, partial failure, retry, and the MIME and size limits.
- Tests for orchestration, checks, permissions, removal, and the UI state.

Out of range:

- A second OCR pipeline or a second queue.
- Changes to the recipe media editor (another change has this work).
- Removal of the source image after a good import.
  The image stays the recipe's image, as the one-image import stores it.

## Flow

The image dialog in Add Recipe makes one recipe from many images of the same recipe.
The Bulk images page makes one recipe for each image.

1. The person opens **Bulk images** in the Library header.
2. The screen accepts up to ten JPG, PNG, or WebP images, 10 MB each and 40 MB in total.
   It does not accept an unsupported type or an image over a limit.
   It also does not accept a same selection or a file past the batch limit, before upload.
3. The screen sends one FormData request.
   Each file field is one image and one recipe.
4. The server repeats the type and size checks from the file metadata before it reads any bytes.
   It then makes a batch id, one item for each image in order, and one recipe id for each item.
   It enqueues no more jobs than the image worker can process.
5. Each job uses the image-import worker:
   extraction, recipe creation, source image storage, and the usual recipe enrichment enrollment.
6. The worker reports the result to the batch.
   A done item keeps its recipe id.
   A failed item keeps its image bytes for a retry.
7. The screen reads the batch again.
   It shows the status of each item and links to the recipes.
   It retries failed items that the person can try again.

## Limits

- One batch holds at most 10 images.
- One image holds at most 10 MB.
  One batch holds at most 40 MB, before base64.
- The multipart request body holds at most 41 MB.
  A `Content-Length` over that limit gets HTTP 413 before Next reads it.
  A batch request with no `Content-Length`, or one that uses
  `Transfer-Encoding: chunked`, gets HTTP 411.
- One person keeps at most 3 open batches.
  An open batch has a queued or processing item, or a failed item with its bytes.
  A done batch frees its slot.
  A batch that the person does not use frees its slot after the 24-hour expiry.
- The batch record and a retryable failed item keep their data for 24 hours.

## Batch model

The batch record lives in Redis near the queue, not in PostgreSQL.
It is temporary state for a workflow that lasts minutes.
It needs no migration and no permanent record.
Each item is a Redis key, below a batch metadata key.
Thus a status write for one item cannot replace a change to another item.
A status write applies only while the item has the status that the write names.
Thus a pump or settlement cannot change a different status.
The batch ends after 24 hours.
A sorted set for each person holds the open batch ids, with the slot expiry as the score.
Thus the server enforces the open-batch limit, and old slots drop out without a sweeper.

Item statuses: `queued`, `processing`, `done`, `failed`.

Error codes are stable identifiers, not text:
`unsupported-type`, `too-large`, `empty-file`, `extraction-failed`, `queue-failed`.
The UI translates each code.

## Pipeline

The worker reads the images and saves the recipe.
Then it runs the same enrichment flow as every other recipe creation.

## Concurrency

A batch has no more jobs in flight than the image-import worker can process.
When an item ends, the batch queues the next image.
The queue keeps one job id for each recipe.
The batch moves an item from `queued` only after its job exists.
Thus the server reports a same enqueue as already in flight, and the server does not make a second job.

## Partial failure and retry

One image with no recipe does not stop the batch.
Its item is set to `failed`, and the other items continue.
An extraction or queue failure keeps the bytes and is retryable.
`retryable` is false when the person must choose the image again.
A file with a type or size that the server does not accept never enters the batch.
The server stops the request before it reads the bytes.
A retry sets the item to `queued` and enqueues it again with the same recipe id.
If the recipe is already present, the worker ends the item.
It does not extract the image again or add a second gallery row.

Two images that read as the same recipe name still make two recipes.
The app already permits recipes with the same name.
The person adds two images, so the batch reports both and does not report one as an error.

## Cleanup

- The batch writes no temporary files.
  Image bytes travel in the job payload, as for the one-image import.
- A done item drops its bytes immediately.
- A failed item keeps its bytes only while a retry can use them.
  The batch ends after 24 hours.
  The failed queue job drops its copy before the batch records the failure.
  Thus the job history does not keep the upload.
- A failed bulk job removes the recipe's image folder, as the one-image import does.
  A non-final attempt keeps the image so a retry can end.
- A good import keeps the source image as the recipe's image.
  Norish does not remove it.

## Permissions

Only an authenticated person can make a batch.
The server makes recipes with the same person, household key, and household ids as the one-image import.
Only the person who makes a batch can read it or retry it.
Another person gets the same result as for a missing batch.

AI must be on.
The entry point is not visible when AI is off.
The mutation does not accept the request when AI is off.

## API

- `recipes.importFromImagesBatch` (mutation, FormData): makes a batch and returns its DTO.
- `recipes.imageImportBatchStatus` (query, `{ batchId }`): returns the person's batch DTO, or null.
- `recipes.retryImageBatchItems` (mutation, `{ batchId, itemIds }`): enqueues the person's failed items again and returns the batch DTO.

The status query reads the image bytes for each item.
Thus one status read can read 40 MB, and the screen reads it every 2 seconds.
A separate key for the bytes is a follow-up.

## UI

The screen at `/recipes/import` has an accessible drop zone.
It has a selection list with previews and remove controls.
It has check notices and a submit button.
After submission it shows all progress and a status list for each image.
It links to the recipes and shows error text for failures.
It has a retry control.
A polite live region reports progress changes.

## Tests

- Queue batch tests: good result, partial failure, concurrency limit, same enqueue, queue failure, retry, ownership, checks, DTO mapping, open-batch limit.
- Worker tests: done settlement, retry without a second extraction, final failure removal, non-final removal protection, another person's recipe.
- tRPC tests: form fields in order, the person's range, AI gate, size checks, status, retry, and another person's batch.
- Web state tests: selection checks, reducer transitions, progress, settled state, retryable ids.
- Playwright AI E2E: one good result and one provider failure, then a retry.
  The screen does not accept an unsupported file before upload.
- Redis integration test: key layout, TTL, compare-and-set, and slot limit.
- HTTP test: the `Content-Length` limit, a request with no length, and a request with `Transfer-Encoding`.
