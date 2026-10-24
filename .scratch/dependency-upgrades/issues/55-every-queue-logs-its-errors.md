# 55 — Every Queue logs its errors

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 5.

## What to build

No `Queue` has an `error` listener. BullMQ then catches the unhandled `error` event and prints its raw stack with `console.error` (`bullmq/dist/esm/classes/queue-base.js:76-89`), so a Redis blip shows up as stack traces that bypass Norish's logger.

1. Every `Queue` gets an `error` listener that logs through the server logger. The queues are built in `createOperationAwareQueue` (`packages/queue/src/operation-aware-queue.ts`), `scheduled-tasks/queue.ts:42`, `store-lookup/queue.ts:19` and `lazy-worker-manager.ts:146`.
2. The `QueueEvents` in `lazy-worker-manager.ts:150` are left alone: `.scratch/architecture-after-upgrades/` ticket 01 deletes them with the lazy-worker manager.

## Acceptance criteria

- [x] Every `Queue` the server constructs has an `error` listener.
- [x] A test shows a queue's `error` reaching the logger.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them. The spec's fix also named QueueEvents; left out because architecture ticket 01, which the maintainer confirmed, deletes them.
- 2026-10-14 (implemented) — `logQueueErrors(queue)` in `packages/queue/src/operation-aware-queue.ts` logs a Queue's `error` as "Queue error" with its `queueName` on the `queue` logger. Every construction site goes through it: `createOperationAwareQueue`, `createScheduledTasksQueue`, `createStoreLookupQueue` and the lazy-worker manager's job-count Queue. `queue-errors.test.ts` emits an error on each factory's queue and sees it reach the logger once; before the change the unhandled `error` was thrown. Five tests with a hand-built Queue mock gained an `on`.
