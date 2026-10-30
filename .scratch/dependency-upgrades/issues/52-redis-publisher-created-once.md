# 52 — The Redis publisher is created once

Status: resolved
Blocked by: 34
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 2.

## What to build

`getPublisherClient` in `packages/shared-server/src/redis/client.ts` returns the existing publisher only while its status is `ready`. During an outage the status is `reconnecting`, so every call connects a new publisher and drops the old one without closing it. Each one keeps reconnecting on its own, so connections pile up for as long as Redis is down, and shutdown closes only the last one.

1. Create the publisher once. A caller gets the same client while it reconnects.
2. Give the publisher `maxRetriesPerRequest: 1`, so a command sent during an outage fails fast instead of waiting forever on a client that is no longer replaced.

## Acceptance criteria

- [x] While Redis is down, repeated `getPublisherClient()` calls return the same client.
- [x] A real-Redis test stops the container, calls the publisher several times, starts it again, and counts one publisher connection in `CLIENT LIST`.
- [x] A command sent while Redis is down rejects instead of hanging.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them.
- 2026-10-14 (implemented) — `getPublisherClient()` creates the publisher once (`globalForRedis.publisherClient ??= createPublisher()`) and never replaces it; ioredis reconnects it. It no longer awaits `connect()`: the shared options are lazy, so the first command connects. The publisher has `maxRetriesPerRequest: 1`; subscribers are duplicated with `maxRetriesPerRequest: null`, so the hub's SUBSCRIBE still waits out an outage as before.
  - `packages/shared-server/__tests__/redis/publisher-redis.test.ts` runs Redis on a fixed host port, `docker stop`s it, asks for the publisher twice, sends a GET, `docker start`s it and reads `CLIENT LIST`. Before the fix the first call during the outage rejected with "Connection is closed." from a freshly built publisher; after it, both calls return the same client, the GET rejects, and `CLIENT LIST` holds one connection besides the test's own (three runs in a row).
- 2026-10-14 (ticket 35) — `maxRetriesPerRequest: 1` replaced by `commandTimeout: 5_000`. With 1, queued commands were flushed after two failed reconnect attempts, about 150 ms into an outage; in the realtime E2E the browsers' refetches after a Redis restart then failed their session reads, which the tRPC context takes as signed out. A command now waits out a restart and fails after five seconds without an answer, which still meets "rejects instead of hanging". `publisher-redis.test.ts` asserts both: a GET sent into a two-second restart is answered, and one sent while Redis stays down fails with "Command timed out".
- 2026-10-14 (review fixes) — Since 8599a593 the test cuts Redis off by closing a TCP proxy between the publisher and the container instead of `docker stop`, so a slow container start cannot fail it. What it proves is unchanged.
