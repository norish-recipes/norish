# 06 — Drawing pictures: one entry and every missing one

Status: resolved
Blocked by: 01, 05

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

A lazy `ingredient-illustration` queue at concurrency 1 with one job id per entry, listed in the admin job monitor. The worker draws square from the entry's name and stores the picture as generated; non-retryable AI errors end the job. `generateImage`, `missingImageCount` and `generateMissing` refuse cleanly on a server that cannot draw. The panel polls the catalog for drawings it is waiting on, and confirms the count before generating missing pictures.

## Acceptance criteria

- [x] A double click or a sweep never queues an entry twice while one is waiting or running.
- [x] Generate is hidden where no image provider is configured.
- [x] The picture appears in the panel without a reload.

## Comments

- 2026-09-17: Implemented; worker and producer tests, and the E2E spec draws through the fake provider's image lane.
