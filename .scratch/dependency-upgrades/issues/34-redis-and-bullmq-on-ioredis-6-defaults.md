# 34 — Redis and BullMQ on ioredis 6's defaults

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

Ticket 18 set `protocol: 2` (RESP2) in two places:

- `getRedisConnectionOptions` in `packages/shared-server/src/redis/client.ts:48`.
- `getBaseOptions` in `packages/queue/src/redis/bullmq.ts:37`. This function also rebuilds the URL parsing, keep-alive, timeouts and retry instead of reusing the shared options.

Both comments say RESP2 keeps "every reply shape" as it was. That is not the reason:

- ioredis 6 already maps RESP3 replies to the RESP2 shapes by default (`replyMapping: "legacy"`, `ioredis/built/redis/RedisOptions.js:56`).
- The one shape that still differs: a Lua script that returns `false` replies `0` under RESP3, where RESP2 gave `null` (`legacyTypeMapping` in `ioredis/built/DataHandler.js` maps RESP3 booleans to numbers). In BullMQ 6.3.14 every `return false` sits inside a Lua helper function, not in a script's reply, so none of BullMQ's replies change. The real-Redis tests below prove it.
- RESP3 only lifts subscriber mode's limits on which commands a connection may send.

**The fix:**

1. **Drop `protocol: 2` everywhere**, including the tests that set it.
2. **ioredis 6's connection defaults.** The hand-rolled retry strategy (`redisRetryStrategy`, and BullMQ's, which gives up after 20 tries), keep-alive and connect timeout go. ioredis 6's defaults replace them: exponential backoff capped at five seconds with jitter, never giving up, and a 30-second keep-alive. The BullMQ client then never gives up reconnecting either.
3. **One options builder.** BullMQ's connections start from `getRedisConnectionOptions()` and add only what BullMQ needs on top: `maxRetriesPerRequest: null`, the ready check and the offline queue.
4. **Tests run what production runs.** Every real-Redis test connects through the production options, not a bare `{ host, port }`. They also use the Redis that compose ships: 8.10.1 in `docker/compose.base.yaml`, while the tests start `redis:8.6.2-alpine`. One shared constant names that image. The tests are:
   - `packages/queue/__tests__/scheduled-tasks/producer-redis.test.ts`
   - `packages/queue/__tests__/queue/lazy-worker-redis.test.ts` (deleted later by `.scratch/architecture-after-upgrades/` ticket 01)
   - `packages/auth/__tests__/auth/secondary-storage.test.ts`
   - `packages/auth/__tests__/auth/auth-handler.test.ts`
   - `apps/web/__tests__/e2e/harness/production-stack.ts:221`
5. **Delete `case "paused"`** in `packages/shared/src/lib/recipe-enrichment.ts:501`. BullMQ 6's `JobState` has no paused state.

If BullMQ misbehaves on RESP3, report it upstream with the failing test. Do not pin the protocol.

## Acceptance criteria

- [x] No Redis connection, in source or tests, sets `protocol`.
- [x] No connection options set a retry strategy, keep-alive or connect timeout; ioredis 6's defaults apply.
- [x] Pub/sub and BullMQ connections are built from one options builder.
- [x] The real-Redis tests use the production options and compose's Redis version, and they pass.
- [x] The realtime E2E project passes, which shows pub/sub working on RESP3.

## Comments

- Filed 2026-10-13 from the branch review. The maintainer wants a clean ioredis 6 and BullMQ 6 migration, with no protocol opt-out.
- 2026-10-14 — The maintainer confirmed: no `protocol: 2` anywhere. This reverses `.scratch/architecture-after-upgrades/` ("RESP2 stays"). The connection-options part of that plan's ticket 05 moved here; the rest of it moved to 35. The test list was corrected: there is no `oidc-flow.test.ts`, and `auth-handler.test.ts` also pinned `protocol: 2` and Redis 8.6.2.
- 2026-10-14 (implemented) — `getRedisConnectionOptions(url)` is the one builder: the parsed URL, `lazyConnect` and `maxRetriesPerRequest: null`, nothing else, so RESP3, the never-give-up backoff and the 30 s keep-alive are ioredis 6's. `getBullConnectionOptions(url)` in `packages/queue/src/redis/bullmq.ts` starts from it and adds connecting at once, `maxRetriesPerRequest: null`, no ready check and the offline queue. `redisRetryStrategy` and its constants are gone; the unit tests assert neither builder sets `protocol`, `retryStrategy`, `keepAlive` or `connectTimeout`.
  - The Redis image is `REDIS_IMAGE` in `packages/shared-server/__tests__/helpers/redis.ts`, read from `docker/compose.base.yaml` itself (`redis:8.10.1`), so the tests cannot drift from compose. The four real-Redis suites and the E2E harness use it, and connect through `getBullConnectionOptions` / `getRedisConnectionOptions` with the container's URL. All four pass on RESP3 (6 + 19 tests).
  - `case "paused"` is gone from `toEnrichmentLifecycleState`.
  - The realtime E2E project runs with ticket 35, which reorders its scenarios; its result is recorded there.
- 2026-10-14 — The realtime project passed 90/90 (`--repeat-each=10`) on RESP3 with ticket 35. Ticket 35 also added three options to the builders: `disconnectTimeout: 200` on every connection, `socketTimeout` on the publisher (10 s, the hub inherits it) and on BullMQ's (15 s). None is a retry strategy, keep-alive or connect timeout.
