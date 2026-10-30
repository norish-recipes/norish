# 35 — Realtime and shutdown recover from a half-open Redis

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13. Absorbs `.scratch/architecture-after-upgrades/` ticket 05 (Redis section of that spec).

## What to build

After a Redis restart that leaves a half-open socket, Norish notices the dead connection within seconds and reconnects. Readers' realtime subscriptions see Lagged, refetch what they missed, and keep receiving Realtime Events. A server stopped after that restart shuts down within its budget.

**Today:**

- The Realtime Hub can listen on a dead socket for minutes, missing every Realtime Event without a Lagged signal, until the operating system's keep-alive gives up.
- Shutdown overruns its budget: BullMQ's `close()` and the hub's QUIT wait on sockets that never answer.
- c148d6a1 hid this by moving the realtime E2E's server-restart scenario ahead of its Redis-restart scenario (`apps/web/__tests__/e2e/realtime/realtime.e2e.ts`).

**The fix:**

1. **Notice a dead socket.** The publisher and the hub's subscriber get a `socketTimeout` of about ten seconds. The hub sends `PING` every fifteen seconds while subscribed, because an idle subscriber writes nothing else that would arm the timeout.
2. **Lagged on reconnect.** A hub reconnect still reports Lagged to its subscriptions, as every reconnect does today (ADR-0034). The realtime contract doesn't change.
3. **Quit without waiting.** The hub no longer sends UNSUBSCRIBE before quitting, and shutdown doesn't wait on a QUIT the dead socket never answers.
4. **Bound BullMQ's close.** A command timeout on the BullMQ connections, or force-closing the workers once the budget runs out.
5. **Names.** The publisher and the hub get `connectionName`s, as the BullMQ client already has.
6. **The E2E goes back to its original order** (Redis restart, then server restart) and becomes the regression test.

## Acceptance criteria

- [x] The publisher and the hub's subscriber have a `socketTimeout` of about ten seconds, and the hub sends `PING` every fifteen seconds while subscribed.
- [x] The hub no longer sends UNSUBSCRIBE before quitting.
- [x] The publisher and the hub carry `connectionName`s.
- [x] A test proves a hub reconnect after a heartbeat timeout reports Lagged.
- [x] `realtime.e2e.ts` runs the Redis restart before the server restart again, and passes with `--repeat-each=5`.
- [x] In that run, the shutdown log names no step over budget (the slow-step log from 0259640c).
- [x] Release notes, under Fixes and Improvements: background jobs and realtime recover by themselves after a Redis restart.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — The maintainer chose to fix this on this branch and mark `.scratch/architecture-after-upgrades/` ticket 05 as its duplicate. Its scope moved here, except its connection-options criterion (now in 34) and "`protocol: 2` stays", which the maintainer reversed: RESP3, no protocol pin.
- 2026-10-14 (implemented) — What changed, and what the realtime E2E taught along the way:
  - **Notice a dead socket.** The publisher has `socketTimeout: 10_000` (`REDIS_SOCKET_TIMEOUT_MS`) and the hub's subscriber inherits it through `duplicate()`. The hub sends `PING` every 15 seconds (`HEARTBEAT_INTERVAL_MS`) while its subscriber is ready, which arms the timeout on an otherwise silent connection. BullMQ's connections get `socketTimeout: 15_000`, above the longest block BullMQ asks Redis for (ten seconds), so a command can no longer sit on a half-open socket for minutes.
  - **Names.** `norish:<pid>:publisher` and `norish:<pid>:realtime-hub`, beside the existing `norish:<pid>:bull`.
  - **Lagged on reconnect** is unchanged (ADR-0034). `packages/shared-server/__tests__/realtime/hub-redis.test.ts` runs the hub against a real Redis behind a proxy that freezes its open connections (a half-open socket: open, silent) and, on fake timers, shows the heartbeat and socket timeout end a live iterable with `redis-reconnect`. With the PING removed it fails.
  - **Quit without waiting.** The hub `disconnect()`s with no UNSUBSCRIBE or QUIT, and so do the publisher and the shared BullMQ client at shutdown, after every consumer has stopped. Every connection starts from `disconnectTimeout: 200`: the first 10-repeat run with info logs caught two lazy workers' QueueEvents taking exactly ioredis's two-second default to drop a socket whose far end, behind Docker Desktop's port forwarding, never answered the FIN.
  - **Bound BullMQ's close.** BullMQ's own `close()` waits for whatever command the worker's run loop has in flight; the first run caught it waiting on a `moveToActive` sent into a half-open socket (until the 15-second timeout). `closeWorker()` (`packages/queue/src/close-worker.ts`) closes a worker with no job running by force and lets a running job finish; `instrumentProcessor`, which every worker's processor goes through, now counts running jobs per queue for it. `packages/queue/__tests__/redis/bullmq-redis.test.ts` covers both: an idle worker, its queue and the shared client close in under a second on frozen sockets (15 s before), and a running job is waited for.
  - **The publisher waits out a restart.** With ticket 52's `maxRetriesPerRequest: 1`, the publisher flushed its queued commands after two failed reconnect attempts, about 150 ms into an outage. Now that the hub reconnects, and the browsers refetch, as soon as Redis is back, those refetches' session reads could fail first; the tRPC context reads a failed session read as signed out, so the browsers got UNAUTHORIZED and stopped (seen once in ten repeats). The publisher now has `commandTimeout: 5_000` instead: a command waits out a restart of a second or two and fails after five seconds of no answer, so an outage still cannot hold a request for ever. `publisher-redis.test.ts` gained the case: a GET sent into a two-second restart is answered (it fails with the old setting).
  - **The E2E.** `realtime.e2e.ts` runs the Redis restart before the server restart again (c148d6a1 reversed), and the server-restart scenario now asserts that the shutdown log names no slow step.
  - **Runs.** `--project realtime --repeat-each=10`, the last one after every fix: 90 passed, no "Shutdown step is slow" in any of the 20 server shutdowns. Earlier runs, each followed by the fix above: 4/5 then 4/5 (a slow "Stop workers": the run loop's in-flight command, then the two-second disconnect), 27/27 and 88/90, then 82/90 with the publisher failure and one connection-count failure.
  - **Seen once, not explained:** in that 82/90 run, "the server's Redis connection count does not depend on how many browsers are open" read 20 connections where it had settled on 21 (repeat 3). The server logged nothing in that window: no reconnect, socket timeout or lazy worker. It did not recur in the 90 repeats after, nor in the 117 before. A suspect worth a look if it comes back: ticket 51's five-second `drainDelay` puts each blocking connection through BullMQ's watchdog (block + 1 s) every cycle, where 5,000 never did.
- 2026-10-14 (later) — `publisher-redis.test.ts` failed once while a Docker image build loaded the VM: `docker start` took long enough that the GET sent into the "restart" used up its five-second budget. The test now makes its outages with the proxy (closing it drops every connection and refuses new ones; listening again on the same port brings Redis back), so Docker's speed no longer counts. It still fails with the old `maxRetriesPerRequest: 1`, and passed three runs in a row beside eight busy CPU loops.
