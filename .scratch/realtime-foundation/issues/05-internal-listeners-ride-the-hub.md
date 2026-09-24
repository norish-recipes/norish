# 05 — Internal listeners ride the hub

**What to build:** the three server-internal subscribers become `getRealtimeHub().on(channel, handler)` registrations, the hub is started and stopped with the process, and no code outside `hub.ts` opens a Redis subscriber connection any more.

1. `packages/trpc/src/connection-manager.ts:89-158`: `startInvalidationListener`/`stopInvalidationListener` become `startConnectionInvalidation()` returning the `hub.on` unsubscribe function; the `on(subscriber, "message")` loop, the `globalThis` abort controller and subscriber, and the 100 ms sleep go. The handler reads the `connection.invalidate` envelope's payload (from 04) and calls `terminateUserConnections(userId, reason)`.
2. `packages/api/src/recipes/enrichment-listener.ts`: keeps `initRecipeEnrichmentListener`/`stopRecipeEnrichmentListener` and `handleRecipeBecameUsable`, registers with `hub.on(recipeEnrichment.channel("recipeBecameUsable", undefined), …)`, and `init` still resolves only once the registration is in place. Its test drops `FakeSubscriber`, mocks the hub, and keeps every handler assertion (duplicate delivery, wrong channel, unparseable payload, throwing handler).
3. `packages/api/src/caldav/event-listener.ts`: `startCalendarSubscriptions` (`:114-190`) registers one `hub.on` per `internal` calendar companion event declared in 04, so the string-splitting of channel names and the raw `psubscribe` go; `startRecipeSubscriptions` (`:312-338`, a live connection around a `TODO`) is deleted; the double cleanup at `:141` and `:180-187` goes with the loop; `stopCaldavSync` returns a promise that resolves once every registration is released, and `shutdown.ts` awaits it before logging "stopped".
4. `apps/web/server/index.ts`: `await startRealtimeHub()` immediately before `initCaldavSync()`. `packages/api/src/startup/shutdown.ts`: `await stopRealtimeHub()` after `stopWorkers()` and before `closeRedisConnections()`; the file's header comment lists the new order (HTTP → WebSocket → internal listeners → workers → hub → Redis).

**Blocked by:** 04.

**Spec:** `.scratch/realtime-foundation/spec.md` § Realtime Hub, § Connection lifecycle

**Status:** ready-for-human

- [x] `grep -rn "createSubscriberClient" packages apps --include=*.ts` matches only `packages/shared-server/src/realtime/hub.ts` and `redis/client.ts`
- [x] `connection-manager.ts` has no message loop, no `setTimeout`, no `globalThis` subscriber; a test delivers a `connection.invalidate` envelope through a fake hub and asserts `terminateUserConnections(userId, reason)`
- [x] `enrichment-listener.test.ts` keeps its handler assertions and asserts `init` registers before resolving
- [x] A test enumerates the events `handleCalendarEvent` handles and asserts each has an `internal` companion in the calendar catalogue and a `hub.on` registration
- [x] `startRecipeSubscriptions` is gone; `stopCaldavSync` is awaited in `shutdown.ts`
- [x] Hub started before `initCaldavSync`, stopped after workers; the startup log shows `Realtime hub started` before the CalDAV line
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments

- Implemented on `claude/realtime-foundation-tickets-db3b92` together with 04.
  - `startConnectionInvalidation()` is called from `initTrpcWebSocket` (the hub is started earlier in `apps/web/server/index.ts`) and the returned release runs from the server's `close` handler; ticket 06 moves that into `stopTrpcWebSocket()`. `unregisterConnection` is synchronous now that there is no multiplexer to close, and the `ws.on("close")` handler wraps it in try/catch.
  - `initRecipeEnrichmentListener` is still `async` for its callers' sake, but the registration is synchronous: `hub.on()` throws when the hub is not started, and that rejection is what "init rejects instead of reporting success" now means.
  - `stopCaldavSync()` resolves once every companion registration is released; `shutdown.ts` awaits it with the same timeout as the other steps, and `stopRealtimeHub()` runs after the workers and before `closeRedisConnections()`.
  - Tests: `packages/trpc/__tests__/connection-manager.test.ts`, `packages/api/__tests__/recipes/enrichment-listener.test.ts` (rewritten against a fake hub), `packages/api/__tests__/caldav/event-listener.test.ts` (enumerates `CALDAV_CALENDAR_EVENTS` against the catalogue and the registrations).
