# 02 — One Redis client module, one URL parser

**What to build:** `packages/shared-server/src/redis/client.ts` becomes the only Redis client module, and the dead copy of the transport in `packages/queue` is deleted. The live module still caches its publisher singleton and in-flight connect promise in module-locals (`client.ts:21-22`), which opens a second connection whenever the module is evaluated twice and lets shutdown close only the one it can see; the dead copy at `packages/queue/src/redis/client.ts:14-55` already reads `globalThis` on every access, with a comment explaining why — port that pattern and its comment. Connection options gain `retryStrategy` (exponential, capped at 5 s, never returning `null`: pub/sub must not give up the way BullMQ's `bullmq.ts:62-74` does after twenty attempts), `keepAlive` and `connectTimeout`, matching BullMQ's values. A new `packages/shared-server/src/redis/url.ts` exports `parseRedisUrl(url): { host, port, username?, password?, db?, tls? }` and is used by both `client.ts` and `packages/queue/src/redis/bullmq.ts`, whose own `parseRedisUrl` (`:31-39`) drops the username, the database index and `rediss://`. `checkRedisHealth` has no callers and is deleted. The five dead files `packages/queue/src/redis/{pubsub,subscription-multiplexer,channel-metadata,index,client}.ts` go, with the `./redis/client` entry in `packages/queue/package.json`; their tests move to shared-server and run against the live module. The startup banner at `apps/web/server/index.ts:84` prints `/ws`; the path is `/trpc`.

**Blocked by:** 01.

**Spec:** `.scratch/realtime-foundation/spec.md` § Redis client

**Status:** ready-for-human

- [x] `getPublisherClient`, `createSubscriberClient` and `closeRedisConnections` read and write `globalThis` only; no module-local copy of the client or the promise
- [x] Publisher and subscriber options include `retryStrategy`, `keepAlive`, `connectTimeout`; a test pins the 5 s cap and that the strategy never returns `null`
- [x] `parseRedisUrl` handles `redis://user:pass@host:6379/2` and `rediss://host` (TLS) and is imported by `bullmq.ts`; no other `new URL(` under `packages/*/src/redis/`
- [x] `packages/queue/src/redis/` contains only `bullmq.ts`; the package export is gone
- [x] `packages/queue/__tests__/redis/connection-singletons.test.ts` → `packages/shared-server/__tests__/redis/client.test.ts`, green against the live module
- [x] `packages/queue/__tests__/redis/channel-metadata.test.ts` → `packages/shared-server/__tests__/redis/channel-metadata.test.ts` (rewritten again in 03 when the codec replaces it)
- [x] New `packages/shared-server/__tests__/redis/url.test.ts`
- [x] Banner prints `WS:   ws://${hostname}:${port}/trpc`
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments

- Implemented on `claude/realtime-foundation-scratch-enjqqw`. `connection-singletons.test.ts` split along package lines: the publisher half became `packages/shared-server/__tests__/redis/client.test.ts` (plus the retry-strategy and connection-option pins); the BullMQ half stayed in the queue package as `packages/queue/__tests__/redis/bullmq.test.ts`, since shared-server cannot import `@norish/queue`. `retryStrategy` is `min(1000 · 2^(times−1), 5000)` and is exported as `redisRetryStrategy` so the test pins it directly. `client.ts` builds its options from `parseRedisUrl` too, so `rediss://` and a database index now work for pub/sub as well as BullMQ.
