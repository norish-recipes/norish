# 03 — Realtime core: hub, catalogue, domain, resume, subscription factory

**What to build:** the new layer's modules, fully tested, with no production callers yet (ticket 04 wires them and deletes the old layer; 03 and 04 land as one stack). Everything is specified in `spec.md` § Implementation Decisions; this ticket is the code and the tests, nothing else.

- `packages/shared/src/contracts/realtime/envelope.ts` — the envelope, `RealtimeCursorMark`, `REALTIME_LAGGED`, `isEventEnvelope`/`assertEventEnvelope`/`isCursorMark`. Move `packages/shared/src/contracts/realtime-envelope.ts` here and update every importer; do not leave a re-export behind. The old `unwrapPayload`, `normalizeSubscriptionData`, `extractMeta` and `NormalizedSubscriptionData` in `packages/shared/src/lib/operation-helpers.ts` are deleted in 07 with their last callers; leave them for now.
- `packages/shared/src/contracts/realtime/catalogue.ts` — `defineRealtimeCatalogue`, `RealtimeScope`, `RealtimeEventSpec`, `EventName`, `ScopeOf`, `PayloadOf`, `ClientEventName`.
- `packages/shared-server/src/realtime/hub.ts` — `RealtimeHub`, `RealtimeLaggedError`, `getRealtimeHub`, `startRealtimeHub`, `stopRealtimeHub`. Reuse the queue/wake loop shape from `packages/shared-server/src/redis/subscription-multiplexer.ts:129-180` (the one part of that file worth keeping) and `createSubscriberClient` from `redis/client.ts`.
- `packages/shared-server/src/realtime/channel.ts` — `buildChannel`, `parseChannel`, `streamKeyFor`. Byte-identical strings to today's `pubsub.ts:37-73` for household, user and broadcast; `internal` where today's code says `global`.
- `packages/shared-server/src/realtime/domain.ts` — `defineRealtimeDomain` with `publish`, `channel`, `channelsFor`; validation modes by `NODE_ENV`; `operationId` from `getCurrentOperationId()`.
- `packages/shared-server/src/realtime/resume.ts` and `publish.lua` — `RESUME_MAXLEN = 1000`, `RESUME_TTL_SECONDS = 86400`, `compareStreamIds`, `parseStreamId`, `encodeCursor`, `decodeCursor`, `identityHashFor`, and the `defineCommand("realtimePublish")` registration on the publisher client. The placeholder substitution in Lua must be a plain string replacement (`string.find` with `plain = true` and concatenation), not a pattern.
- `packages/trpc/src/realtime-subscription.ts` and `realtime-resume.ts` — `realtimeSubscription`, `realtimeSubscriptionInput`, `openCursor`, `resumeThenLive`. Stream reads use `getPublisherClient()`.
- `packages/trpc/__tests__/mocks/realtime.ts` — `createFakeRealtimeDomain(catalogue)` recording `{ event, payload, target, channel }` through the real codec. It replaces the seven emitter fakes in 04.
- Package `exports` entries in `packages/shared/package.json` (`./contracts/realtime/*`) and `packages/shared-server/package.json` (`./realtime/hub`, `./realtime/domain`, `./realtime/channel`, `./realtime/resume`).

**Blocked by:** 02.

**Spec:** `.scratch/realtime-foundation/spec.md` § Implementation Decisions

**Status:** ready-for-human

- [x] `packages/shared-server/__tests__/realtime/hub.test.ts` (fake `EventEmitter` subscriber, as in `packages/api/__tests__/recipes/enrichment-listener.test.ts`): `createSubscriberClient` called once regardless of subscriptions; first listener `SUBSCRIBE`s, last listener `UNSUBSCRIBE`s; subscribe → abort → subscribe in one tick leaves exactly one Redis subscription; `subscribe()` yields nothing before `SUBSCRIBE` resolves (deferred mock); overflow ends only the slow iterable with `queue-overflow` and the dropped count while a sibling receives every message; a second `ready` logs `realtime.reconnected`, ends live iterables with `redis-reconnect`, and the hub issues no `SUBSCRIBE` of its own; abort resolves a pending `next()` as done and releases the channel; `subscribe()` before `startRealtimeHub()` rejects
- [x] `realtime/channel.test.ts`: strings pinned for all four scopes; `parseChannel` rejects `global` and non-`norish` prefixes
- [x] `realtime/domain.test.ts`: `policy` routes `everyone → broadcast`, `household → household:{key}`, `owner → user:{id}`; `operationId` stamped from the operation context; invalid payload throws under `NODE_ENV=test` and logs-and-drops under `production`; a Redis error never rejects; a household publish records one `realtimePublish` call with the stream key `norish:stream:{ns}:household:{key}:{event}`, `MAXLEN ~ 1000` and TTL 86400; an `internal` publish records a plain `PUBLISH` and no stream call
- [x] `realtime/publish-script.test.ts` against a real Redis (skipped without `REDIS_URL`): the stream entry id equals the `eventId` inside the PUBLISHed message; the placeholder never survives
- [x] `realtime/resume.test.ts`: cursor round-trip; malformed → `cursor-invalid`; `compareStreamIds` orders `(ms, seq)` tuples, not strings
- [x] `packages/trpc/__tests__/realtime-subscription.test.ts` (fake Redis exposing `xrevrange`/`xrange`, fake hub): a fresh subscription yields a Cursor Mark first whose cursor holds each channel's last stream id; channel selection per scope, including a household-less user (`householdKey === userId`); a policy subscription carries three ids and merges three replays by id; replay from a cursor yields the two later entries in order with `meta.eventId` equal to their ids, then live; a live envelope whose id equals a replayed entry's is yielded once; stream first id > cursor → `PRECONDITION_FAILED`/`REALTIME_LAGGED` with cause `cursor-trimmed`; missing key with a cursor younger than the TTL continues; cursor older than the TTL → `cursor-expired` without a Redis call; malformed → `cursor-invalid`; cursor from household A while ctx is household B → `identity-changed` and no `XRANGE` against A's stream; a schema-failing event is dropped with a warn; hub `queue-overflow` → `PRECONDITION_FAILED`; a `// @ts-expect-error` line proves an `internal` event is not subscribable
- [x] `packages/trpc/__tests__/ws-resume.test.ts`: a real `ws` server on an ephemeral port with `applyWSSHandler` and a tracked test procedure, `createWSClient` + `wsLink` as the client; kill the socket server-side; the second subscribe request carries `lastEventId` equal to the last tracked id
- [x] No production file imports the new modules yet; `pnpm build` proves they compile
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments

- Implemented on `claude/realtime-foundation-scratch-enjqqw`. Notes for 04:
  - `publish.lua` is read from disk through `resolveExistingWorkspacePath` (the prompts-loader pattern), so it ships in the Docker image with the rest of `packages/`; it is not bundled into `dist-server`. `packages/shared-server/__tests__/realtime/publish-script.test.ts` was run against a local `redis-server` and passes; it skips without `REDIS_URL`.
  - The stream entry keeps the `$ID$` placeholder; only the PUBLISHed copy carries the id. The resume path sets `meta.eventId` from the entry id, as the spec's step 5 says.
  - `openCursor` returns `{ cursor, resume }`; a fresh subscription (no `lastEventId`) does not `XRANGE` — there is nothing to resume — and only the seam dedupe applies. `resumeThenLive` takes that object rather than the bare cursor.
  - `RealtimeLaggedError.dropped` on `queue-overflow` counts the event that did not fit plus everything still queued for that listener (all of it is discarded); on `redis-reconnect` it is the queued count.
  - `hub.on()` before `startRealtimeHub()` throws synchronously; `subscribe()` before start rejects on the first `next()`.
  - `getRealtimeHub().subscribe()` registers its listener synchronously, so the factory's "listeners first" ordering holds without an extra await; the iterable yields nothing until `SUBSCRIBE` resolves.
  - `@trpc/client` was added as a devDependency of `@norish/trpc` for `ws-resume.test.ts`.
  - `redis/channel-metadata.ts` and its moved test stay until 04 deletes `pubsub.ts`, its last importer.
  - `RealtimeEventScope` no longer includes `global`; the old transport still emits `global` channels through a cast until 04 removes it.
- 2026-09-21, found by the realtime browser suite (ticket 10): `reconcile()` decided whether to drop a channel's state from the `wanted` it computed *before* awaiting the `UNSUBSCRIBE`. A listener registering during that round trip (a client's reset after a lag, a reconnect) was added to the state, its own step was queued, and then the finishing step deleted the state with the listener inside it — the queued step found no state, never `SUBSCRIBE`d, and `dispatch` never found the listener again: a subscription that had yielded its Cursor Mark and would never deliver. The refcount is now re-read after the round trip; `hub.test.ts` › "keeps a listener that registers while the last listener's UNSUBSCRIBE is in flight" is red on the old code.

