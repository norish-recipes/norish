# Realtime Foundation: one hub, one catalogue, one idiom, and Resume

Status: ready-for-agent

## Problem Statement

Norish's realtime layer grew by accretion, and it shows in four places at once.

**The transport is four transports.** A `TypedRedisEmitter` publishes into Redis pub/sub and returns a boolean nobody reads (`packages/shared-server/src/redis/pubsub.ts:124-165`; 146 call sites, roughly 138 of them floating promises). On the receiving side there are four hand-rolled subscriber loops: a per-WebSocket `SubscriptionMultiplexer` that opens **one Redis connection per browser tab**, pattern-subscribes to everything the user could ever receive and pins the household key at connect time (`packages/shared-server/src/redis/subscription-multiplexer.ts`); `createSubscription`, which opens a Redis connection per channel and leaks it forever when no abort signal is passed (`pubsub.ts:79-122`); the connection-manager's invalidation loop, which stops by sleeping 100 ms (`packages/trpc/src/connection-manager.ts:89-158`); and the CalDAV listener, which `psubscribe`s a raw pattern, string-splits channel names, and holds a second live connection around a body whose only content is a `TODO` (`packages/api/src/caldav/event-listener.ts:114-190, 312-338`). A server process holds about twenty Redis connections idle plus one per connected client. Nothing bounds a queue anywhere. None of this has a unit test — not the multiplexer, not `pubsub.ts`, not `ws-server.ts`, not the connection manager.

**The code exists twice, and the fix landed in the dead copy.** `packages/queue/src/redis/{pubsub,subscription-multiplexer,channel-metadata,index,client}.ts` are ~700 lines nothing imports. Three of them are byte-identical to the shared-server files; `client.ts` is _better_ than the live one: it reads its singleton from `globalThis` on every access, which is exactly the fix the live `packages/shared-server/src/redis/client.ts:21-22` still needs. The repo's only Redis unit tests (`packages/queue/__tests__/redis/*`) test the dead copy.

**Fifty-eight procedures, two idioms, no contract.** Twenty subscription procedures go through `createEnvelopeAwareSubscription` and yield the envelope; thirty-eight are hand-written twenty-five-line copies that strip the envelope's `meta` and `yield data as SomeType` unchecked (`packages/trpc/src/routers/*/subscriptions.ts`). Event payload types are declared in `packages/shared-server/src/realtime/*.ts`, re-declared in `packages/trpc/src/routers/*/types.ts` (CalDAV twice), copied a third time into client hooks, and once inline in a procedure body. Three emitters live in `packages/trpc` where the queue cannot reach them. Zod schemas exist for households and CalDAV and are used only through `z.infer`; **no payload is validated at publish or subscribe time**. Because `publish` falls back to a raw, un-enveloped message for channels it cannot parse, the wire carries two formats, and the client compensates with a proxy that spreads the payload _and_ attaches it under `.payload` (`packages/shared-react/src/providers/trpc-provider.tsx:34-111`) — which is why the hooks carry forty `any`s and four copies of the same cast. The seven emitter fakes in `packages/trpc/__tests__/mocks/` build channel strings without the namespace segment, so no test has ever asserted a real channel.

**Lifecycle is racy and slow.** The WebSocket server verifies the session twice per connection, checks no `Origin`, and registers an async `server.on("close")` handler that `shutdown.ts` never awaits. `server.close()` does not close live sockets, so every restart with connected clients waits out the 30-second shutdown timeout. Multiplexers are never closed at shutdown. Changing households mid-connection is handled by killing the socket — and in four places the announcing event is emitted unawaited _before_ the kill is awaited (`packages/trpc/src/routers/households/households.ts:147-152`), so the departing view may never see it. A disconnected client has no way to learn what it missed except the full Recovery refetch (ADR-0011). The startup banner advertises `/ws`; the path is `/trpc`. The self-hoster docs say nothing about WebSockets, reverse-proxy `Upgrade` headers, or the fact that the server pings every 20 s.

**The client half is the same story.** Reconnect is a flat one-second retry with no backoff or jitter (`packages/shared-react/src/providers/trpc-links.ts:340-348`); "unauthorized" is detected by a regex on the close reason; a policy change invalidates _every query in the app_ (`hooks/permissions/use-permissions-query.ts:24`) and that event is subscribed twice; CalDAV subscribes to the same fact three times and toasts twice; five share subscriptions differ only in name; ratings do a surgical cache update and then throw it away with a blanket invalidate; two web hook wrappers are dead but their tests keep them alive.

## Solution

**Delete the layer and rebuild it.** Nothing is adapted, wrapped, or kept for compatibility: a ticket that touches a file deletes its legacy counterpart in the same ticket, and at the end of the server stack no old transport, emitter, helper, or shim exists. Web and server ship together. The mobile app is parked (ticket 01) and gets its own rewrite plan; it is expected to break against this release.

Three primitives replace everything:

1. A **Realtime Catalogue** per domain — client-safe, in `packages/shared/src/contracts/realtime/` — declares every event once: its name, its Scope (`household`, `user`, `policy`, `broadcast`, `internal`) and its zod payload schema. Server publishers, tRPC procedures and client handler types all derive from it. There is no second place to declare an event.
2. A **Realtime Hub** — one per process, in `packages/shared-server/src/realtime/hub.ts` — holds exactly one Redis subscriber connection, subscribes to exact channels by refcount, and fans out in-process through bounded queues. Server-internal listeners register callbacks on it; tRPC subscriptions iterate it. A subscriber that falls behind is **Lagged**: its iterable ends with a typed error, the client refetches that domain and resubscribes.
3. One subscription factory, `realtimeSubscription(domain, event)`, makes every procedure one line, derives channels from the event's Scope and the subscriber's _current_ identity, validates each event against its schema, and yields envelopes only.

And one capability the old layer never had: **Resume**. Every non-internal publish is appended to a per-channel Redis Stream in the same atomic script that publishes it, and the stream entry id becomes the envelope's `eventId`. Every subscription is `tracked()` with an opaque, identity-bound Cursor; the tRPC WebSocket link resends it on reconnect, and the server delivers what the client missed, in order, before continuing live — or ends the subscription Lagged when it cannot. Recovery (ADR-0011) stays the convergence guarantee; Resume shrinks the window it has to cover.

Connection lifecycle authenticates once, checks `Origin`, closes unauthenticated sockets with a code the client can act on, and shuts down in seconds. The client gets one hook with typed `(payload, meta)` handlers, exponential backoff with jitter, and a single reaction to Lagged.

## User Stories

### Self-hosters and administrators

1. As a self-hoster, I want the number of Redis connections my server holds to be independent of how many browser tabs my household has open, so that a family evening does not exhaust my Redis.
2. As a self-hoster, I want a server restart to complete in seconds with clients connected, so that deploys are not thirty-second stalls.
3. As a self-hoster, I want a page that tells me the WebSocket path, the reverse-proxy headers, and the idle timeout my proxy must exceed, so that "realtime does not work behind nginx" is a documented fix rather than a mystery.
4. As a self-hoster, I want a WebSocket upgrade from a foreign origin refused, so that a malicious page cannot ride my browser's session cookie onto my instance's socket.
5. As a self-hoster, I want a Redis blip logged as one clear line, so that I can tell "Redis reconnected, clients refetched" from an outage.
6. As a self-hoster, I want the startup banner to print the path the server actually serves.

### Cooks

7. As a cook, I want the grocery a housemate added while my phone was in a tunnel to appear when I come back out, in order, without a reload.
8. As a cook, I want a validation failure on my own change to toast me and nobody else in the household.
9. As a cook, I want everything that works today — groceries, stores, recipes, cookbooks, calendar, households, CalDAV, archives — to keep working exactly as it does, so that a rebuild is something I never notice.
10. As a cook whose session expired, I want the app to tell me to sign in again rather than reconnecting forever.

### Maintainers and contributors

11. As a maintainer, I want adding a realtime event to be one catalogue entry, so that the publisher, the procedure and the client type follow from it.
12. As a maintainer, I want every subscription procedure to be one line, so that there is nothing to copy and nothing to drift.
13. As a maintainer, I want a publish that violates its schema to fail my test, so that a payload contract cannot rot silently.
14. As a maintainer, I want client handlers typed from the catalogue, so that `any` disappears from the hooks along with the shim that caused it.
15. As a maintainer, I want exactly one place that talks to Redis pub/sub, so that a change to connection handling is one edit.
16. As a maintainer, I want the transport unit-tested against a fake Redis, so that the next regression is caught before a release.
17. As a contributor, I want no second way to publish or subscribe to exist, so that I cannot pick the wrong one.

## Non-goals

- Exactly-once delivery, or ordering across channels. Delivery stays at-most-once plus a bounded Resume; Recovery remains the safety net.
- A transactional outbox. `.scratch/recipe-enrichment/spec.md` forbids one and that rule stands: a publish can still be lost if the process dies between the database commit and the stream write.
- Echo suppression. Every client handler stays an idempotent merge by identity (the convention recorded in the cookbooks, grocery-aisles and grocery-linking specs); Resume and Recovery are safe to apply on top of each other because of it.
- The mobile app, in any form: its providers, its hook wiring, its cache-wipe reconnect, its unauthorized handling. It is parked by ticket 01 and gets its own plan.
- Keeping any part of the old layer alive for compatibility.

## Implementation Decisions

### Wire format

Channel: `norish:{namespace}:{scope}:{id?}:{event}`, scope segment one of `household`, `user`, `broadcast`, `internal` (`policy` is a publish-time choice, never a channel segment; `global` is gone). Envelope, declared in `packages/shared/src/contracts/realtime/envelope.ts` (the old `realtime-envelope.ts` moves there; imports are updated; nothing re-exports the old path):

```ts
interface RealtimeEventMeta {
  version: 1;
  eventId: string; // Resume Buffer stream id ("<ms>-<seq>") for buffered scopes; a UUID for internal events
  operationId?: OperationId; // from the AsyncLocalStorage operation context, when the publish ran inside one
  eventName: string;
  namespace: string;
  scope: "household" | "user" | "broadcast" | "internal";
  channel: string;
  occurredAt: string;
}
interface RealtimeEventEnvelope<P> {
  meta: RealtimeEventMeta;
  payload: P;
}
interface RealtimeCursorMark {
  mark: "cursor";
}
export const REALTIME_LAGGED = "REALTIME_LAGGED";
```

### Realtime Catalogue — `packages/shared/src/contracts/realtime/<domain>.ts`

```ts
type RealtimeScope = "household" | "user" | "policy" | "broadcast" | "internal";
interface RealtimeEventSpec<S extends RealtimeScope = RealtimeScope, P = unknown> {
  scope: S;
  payload: z.ZodType<P>;
}
interface RealtimeCatalogue<E extends Record<string, RealtimeEventSpec>> {
  namespace: string;
  events: E;
}
function defineRealtimeCatalogue<E extends Record<string, RealtimeEventSpec>>(
  namespace: string,
  events: E
): RealtimeCatalogue<E>;
type EventName<C> = keyof C["events"] & string;
type ScopeOf<C, E extends EventName<C>> = C["events"][E]["scope"];
type PayloadOf<C, E extends EventName<C>> = z.infer<C["events"][E]["payload"]>;
type ClientEventName<C> = {
  [E in EventName<C>]: ScopeOf<C, E> extends "internal" ? never : E;
}[EventName<C>];
```

Namespaces: `grocery`, `recipe`, `cookbook`, `rating`, `store`, `calendar`, `caldav`, `household`, `permissions`, `archive`, `recipe-enrichment`, `connection`. A payload whose DTO has no zod schema uses `z.custom<T>()` with a one-line comment; each ticket lists the ones it introduces so they can be replaced with real schemas later.

### Realtime Hub — `packages/shared-server/src/realtime/hub.ts`

```ts
class RealtimeLaggedError extends Error {
  readonly name = "RealtimeLaggedError";
  constructor(
    readonly channel: string,
    readonly reason: "queue-overflow" | "redis-reconnect" | "cursor-invalid" | "cursor-expired" | "cursor-trimmed" | "identity-changed",
    readonly dropped: number
  );
}
interface RealtimeHub {
  on(channel: string, handler: (envelope: RealtimeEventEnvelope) => void): () => void; // callback, no queue: server-internal listeners
  subscribe(channel: string, opts: { signal?: AbortSignal; maxQueue?: number }): AsyncIterable<RealtimeEventEnvelope>; // bounded: tRPC
  stats(): { channels: number; listeners: number; dropped: number };
}
function getRealtimeHub(): RealtimeHub; // globalThis, read on every access
function startRealtimeHub(): Promise<void>; // one createSubscriberClient(); attaches message / ready / end handlers
function stopRealtimeHub(): Promise<void>; // ends every iterable cleanly, unsubscribes all, quits
```

- One Redis subscriber connection per process. Exact-channel `SUBSCRIBE` when a channel gains its first listener, `UNSUBSCRIBE` when it loses its last; all Redis-side operations for one channel run through one per-channel promise chain, so a fast resubscribe can never race an unsubscribe. `subscribe()` yields nothing until the `SUBSCRIBE` round trip has resolved. No `PSUBSCRIBE` anywhere.
- Message path: `superjson.parse` → `isEventEnvelope` → fan-out. A non-envelope message is logged once per channel and dropped.
- Each `subscribe()` listener has a bounded queue, default 100. On overflow the listener is removed at once, the drop is counted, and the iterable's next `next()` throws `RealtimeLaggedError(channel, "queue-overflow", dropped)`. Siblings on the same channel are unaffected.
- On a `ready` after the first (ioredis reconnected), the hub logs `{ event: "realtime.reconnected", channels }` at warn and ends every live iterable with `redis-reconnect`. ioredis re-issues the subscriptions itself (`autoResubscribe`); the hub must not. `on()` handlers stay registered — internal listeners accept the loss window their own specs document.
- Abort removes the listener, resolves a pending `next()` as done, and decrements the refcount.
- `startRealtimeHub()` is awaited in `apps/web/server/index.ts` before `initCaldavSync()`; `subscribe()` before start rejects. `stopRealtimeHub()` is awaited in `packages/api/src/startup/shutdown.ts` after workers stop and before `closeRedisConnections()`. Shutdown order: HTTP → WebSocket → internal listeners → workers → hub → Redis.

### Domain — `packages/shared-server/src/realtime/domain.ts`

```ts
type TargetFor<S extends RealtimeScope> = S extends "household"
  ? { householdKey: string }
  : S extends "user"
    ? { userId: string }
    : S extends "policy"
      ? { viewPolicy: PermissionLevel; householdKey: string; userId: string }
      : undefined; // broadcast, internal
interface RealtimeDomain<C extends RealtimeCatalogue> {
  catalogue: C;
  publish<E extends EventName<C>>(
    event: E,
    payload: PayloadOf<C, E>,
    target: TargetFor<ScopeOf<C, E>>
  ): Promise<void>;
  channel<E extends EventName<C>>(event: E, target: TargetFor<ScopeOf<C, E>>): string;
  channelsFor<E extends EventName<C>>(
    event: E,
    identity: { userId: string; householdKey: string }
  ): string[]; // policy → [household, broadcast, user]
}
function defineRealtimeDomain<C extends RealtimeCatalogue>(catalogue: C): RealtimeDomain<C>;
```

- `policy` folds today's `emitByPolicy`: `everyone → broadcast`, `household → household:{householdKey}`, `owner → user:{userId}`.
- `publish` validates with `payload.safeParse`. A failure **throws when `NODE_ENV !== "production"`** and is **logged at error and dropped in production**. A Redis failure is always logged and dropped. `publish` never rejects in production: the mutation already committed and its announcement must not fail it. It returns `Promise<void>`; there is no boolean.
- `operationId` is read from `getCurrentOperationId()` exactly as today.
- For every scope except `internal`, `publish` runs the Resume script (below) instead of a bare `PUBLISH`.
- Domains are stateless. Each `packages/shared-server/src/realtime/<domain>.ts` is one line: `export const groceries = defineRealtimeDomain(groceriesRealtime);`. No `globalThis` emitter singletons.
- Channel codec in `packages/shared-server/src/realtime/channel.ts`: `buildChannel`, `parseChannel`, `streamKeyFor`. It replaces `redis/channel-metadata.ts` and produces byte-identical strings for household, user and broadcast channels.

### Resume — `packages/shared-server/src/realtime/resume.ts` and `publish.lua`

**Buffer.** The stream key is the channel with `norish:` replaced by `norish:stream:`. One Lua script, registered once on the publisher client with ioredis `defineCommand("realtimePublish", { numberOfKeys: 2 })`, does, atomically: `XADD stream MAXLEN ~ 1000 * e <envelope>` → replace the placeholder `"eventId":"$ID$"` in the envelope string with the returned id using a plain (non-pattern) substitution → `PUBLISH channel <envelope>` → `EXPIRE stream 86400` → return the id. Bounds are two and fixed: `RESUME_MAXLEN = 1000` entries per channel (approximate trim, cheap) and `RESUME_TTL_SECONDS = 86400` refreshed on every write, so an idle channel's stream disappears a day after its last event. The script is worth its one placeholder substitution because it makes append-then-publish atomic: a live event can never be observed before its buffered copy exists, which is what lets a subscription register its live listeners, read the stream, and dedupe at the seam without a second read.

**Cursor.** Opaque to the client: `1.<identityHash>.<id0>,<id1>[,<id2>]` — a version, the first eight hex characters of `sha1(userId + "|" + householdKey)`, and one stream id per channel in `channelsFor()` order (household, broadcast, user for `policy`; one id otherwise). `0-0` means "nothing seen on this channel". Stream ids compare as `(ms, seq)` tuples (`compareStreamIds`), never as strings. `encodeCursor`/`decodeCursor` live here; a malformed cursor decodes to `RealtimeLaggedError("cursor-invalid")`.

### Subscription factory — `packages/trpc/src/realtime-subscription.ts` and `realtime-resume.ts`

```ts
export const realtimeSubscriptionInput = z.object({ lastEventId: z.string().nullish() }).optional();
export type RealtimeSubscriptionItem<P> = RealtimeEventEnvelope<P> | RealtimeCursorMark;

export function realtimeSubscription<C extends RealtimeCatalogue, E extends ClientEventName<C>>(
  domain: RealtimeDomain<C>,
  event: E,
  opts?: { maxQueue?: number }
) {
  return authedProcedure.input(realtimeSubscriptionInput).subscription(async function* ({
    ctx,
    input,
    signal,
  }) {
    const identity = { userId: ctx.user.id, householdKey: ctx.householdKey }; // householdKey === userId when household-less
    const channels = domain.channelsFor(event, identity); // the CURRENT identity, always
    const live = channels.map((c) =>
      getRealtimeHub().subscribe(c, { signal, maxQueue: opts?.maxQueue })
    ); // 1. listeners first
    const cursor = await openCursor(channels, identity, input?.lastEventId); // 2. decode, or mint the initial cursor
    try {
      yield tracked(encodeCursor(cursor), CURSOR_MARK); // 3. always: a quiet subscription is resumable too
      for await (const item of resumeThenLive(channels, cursor, live, signal)) {
        // 4. XRANGE each channel, merge by id, then live
        const parsed = domain.catalogue.events[event].payload.safeParse(item.payload);
        if (!parsed.success) {
          log.warn(
            { channel: item.meta.channel, issues: parsed.error.issues },
            "Dropped realtime event failing its schema"
          );
          continue;
        }
        yield tracked(encodeCursor(cursor), { meta: item.meta, payload: parsed.data });
      }
    } catch (err) {
      if (err instanceof RealtimeLaggedError) {
        log.warn(
          {
            userId: identity.userId,
            event,
            channel: err.channel,
            reason: err.reason,
            dropped: err.dropped,
          },
          "Realtime subscription lagged"
        );
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: REALTIME_LAGGED, cause: err });
      }
      throw err;
    }
  });
}
```

Resume algorithm (`realtime-resume.ts`), in order:

1. Register the live listeners; they buffer from now on.
2. Without `lastEventId`: the initial cursor is each channel's last stream id (`XREVRANGE key + - COUNT 1`; `0-0` when the key is absent), read after step 1.
3. With `lastEventId`: decode it (malformed → Lagged `cursor-invalid`); if its identity hash or its channel count differs from the current identity → Lagged `identity-changed` (a user who left a household never reads that household's stream: channels come from the current context and the old cursor is refused); if any id's `ms` part is older than `RESUME_TTL_SECONDS` → Lagged `cursor-expired`, without touching Redis.
4. Per channel whose id is not `0-0`: if the stream key is missing and the cursor is younger than the TTL, nothing was published since — continue; if the stream's first id (`XRANGE key - + COUNT 1`) is greater than the cursor → Lagged `cursor-trimmed` (conservative: the cursor's own entry having been trimmed counts as a gap); otherwise `XRANGE key (cursor + COUNT 1000`.
5. K-way merge the replayed entries by id (ids are timestamps, so cross-channel order is approximate and within-channel order exact); for each, set `meta.eventId` to the entry id, advance that channel's cursor, yield tracked.
6. Live: for an envelope from channel _i_, skip it when `eventId <= cursor[i]` (the seam), otherwise advance and yield tracked.

Stream reads go through the publisher connection (a subscriber connection cannot run `XRANGE`). Every Lagged reason reaches the client as `PRECONDITION_FAILED` with message `REALTIME_LAGGED`, the same as queue overflow. `internal` events are not subscribable at the type level. The identity a subscription runs under is frozen for its lifetime; a Scope Change restarts the socket (ADR-0033).

### Connection lifecycle — `packages/trpc/src/ws-server.ts`, `context.ts`, `connection-manager.ts`

- The `upgrade` handler authenticates once and stores the `User` on `req.realtimeIdentity`; `createWsContext` reads it. No second `getVerifiedSession`.
- An `Origin` header, when present, must match `AUTH_URL`'s origin, an entry of `TRUSTED_ORIGINS`, or the request host; otherwise the upgrade is refused with `403`. An absent `Origin` (native clients, `curl`) is accepted.
- An unauthenticated upgrade completes the handshake and is then closed with **4401 Unauthorized**, so the client can tell "sign in again" from "server unreachable" without inspecting reason strings.
- A Scope Change closes with **4000** via the `connection.invalidate` internal event, after the announcing domain event has been awaited.
- `stopTrpcWebSocket()` broadcasts tRPC's reconnect notification, closes every socket with **1012 Service Restart**, awaits `wss.close()`, and is awaited from `shutdown.ts` right after the HTTP server closes. The never-awaited `server.on("close")` handler goes.
- `unregisterConnection` is synchronous and the `ws.on("close")` handler wraps it in try/catch. Keep-alive stays 20 s ping / 5 s pong.
- Internal listeners — connection invalidation, `recipeBecameUsable`, the CalDAV calendar reactions — are `hub.on()` registrations. CalDAV's household pattern becomes per-event `internal` companion events declared in the calendar catalogue and published beside the household event.

### Redis client — `packages/shared-server/src/redis/client.ts` and `url.ts`

One module. The publisher singleton and its in-flight connect promise are read from `globalThis` on every access (the pattern in the dead queue copy, with its comment). Connection options gain `retryStrategy` (exponential, capped at 5 s, never giving up), `keepAlive` and `connectTimeout`, matching what BullMQ already sets. `parseRedisUrl(url)` in `redis/url.ts` returns `{ host, port, username?, password?, db?, tls? }` and is used by both this module and `packages/queue/src/redis/bullmq.ts`. `checkRedisHealth` has no callers and is deleted.

### Client — `packages/shared-react/src/realtime/use-realtime-subscription.ts` and `providers/trpc-links.ts`

```ts
function useRealtimeSubscription<P>(
  procedure,
  handlers: {
    onEvent: (payload: P, meta: RealtimeEventMeta) => void;
    lagQueryKeys?: QueryKey[];
    onLag?: () => void;
    enabled?: boolean;
  }
) {
  const queryClient = useQueryClient();
  const sub = useSubscription(
    procedure.subscriptionOptions(undefined, {
      enabled: handlers.enabled,
      onData: (data) => {
        if (isCursorMark(data)) return;
        assertEventEnvelope<P>(data);
        handlers.onEvent(data.payload, data.meta);
      },
      onError: (err) => {
        if (!isRealtimeLagged(err)) return;
        handlers.onLag
          ? handlers.onLag()
          : handlers.lagQueryKeys?.forEach(
              (k) => void queryClient.invalidateQueries({ queryKey: k })
            );
        sub.reset(); // a fresh subscription, no cursor
      },
    })
  );
  return sub;
}
```

- `lastEventId` is resent by tRPC's `wsLink` automatically for a tracked subscription; the hook never touches it.
- Anything that is neither a Cursor Mark nor an envelope is a programming error (assertion), not a case to tolerate.
- Transport: `retryDelayMs` is full-jitter exponential backoff, `random() * min(30_000, 1_000 * 2 ** attemptIndex)`, with the RNG injectable for tests; close code 4401 stops retrying and fires `onWebSocketUnauthorized` once per client instance (the reason-string regex is deleted); every close, including a normal `1000`, reaches `onWebSocketClose`; `ConnectionStatus` is `"idle" | "connected" | "disconnected"`; links are typed `TRPCLink<TRouter>`. `shouldNotifyWebSocketDisconnect`, `getWsLazyEnabled` and `invalidateOnReconnect` are deleted (Recovery owns reconnect refetch, ADR-0011). The web provider passes an `onWebSocketUnauthorized` handler that routes to sign-in.
- Handler fixes made while migrating: the permissions hook invalidates only `permissions.get` and the recipe list keys, and its duplicate subscription in the recipe-detail hook goes; CalDAV keeps one subscription (`onSyncEvent`); the five share subscriptions become one `onShareEvent`; the ratings hook keeps its surgical `setQueriesData` and drops the blanket invalidate; hand-written query keys become `trpc.<proc>.queryKey()`. No echo suppression is added anywhere.

## Release shape

- Tickets 03–06 (core, cutover, internal listeners, lifecycle) land as **one stack**: the server never runs both designs, and ticket 03's new modules gain their callers in 04 before anything ships.
- Tickets 07–08 (client) ship in the same release as the server stack. Web and server are one deployable.
- The mobile app is parked by ticket 01 and unsupported on this release; the release notes say so under Upgrade notes.
- The Origin check is an Upgrade note: an operator whose proxy rewrites `Origin` must list the public origin in `TRUSTED_ORIGINS`.
- No new user-facing strings anywhere; `pnpm i18n:check` is unaffected.

## Verification

- Every ticket: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green, plus the tests it names.
- Unit: the hub, domain, channel codec, resume module, subscription factory, WebSocket server and client hook each get a test file against a fake Redis (`EventEmitter` subscriber, recorded `xadd`/`xrange`/`xrevrange`/`publish` calls) — the pattern of `packages/api/__tests__/recipes/enrichment-listener.test.ts`. One real-Redis test for the Lua script, skipped when `REDIS_URL` is unset. One real-`ws` test proving the client link resends `lastEventId` after a server-side socket kill.
- E2E, new `apps/web/__tests__/e2e/realtime/realtime.e2e.ts` on the existing production-stack harness (`apps/web/__tests__/e2e/harness/production-stack.ts`, `trpc.ts`): two browser contexts in one household see each other's grocery create; a grocery `failed` toast reaches only the failing context; a household join mid-connection restarts the joining context's socket (4000) and later events reach it; Redis `CLIENT LIST` count is the same with one context and with five; a Redis restart logs `realtime.reconnected` and both contexts converge; a context taken offline for five seconds (CDP network emulation) receives the missed grocery create through Resume before Recovery's refetch resolves (assert the handler fired with the missed id).
- Manual: ticket 10.
