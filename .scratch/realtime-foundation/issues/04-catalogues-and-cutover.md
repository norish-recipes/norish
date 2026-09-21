# 04 — Catalogues for every domain and the cutover of all publishers and procedures

**What to build:** every realtime event declared once in a catalogue, every publish site moved to its domain object, all 58 subscription procedures rewritten as `realtimeSubscription` lines, and the old layer deleted — in one ticket, so that the server never has two ways to publish or subscribe. Lands as one stack with 03, 05 and 06.

**Catalogues** in `packages/shared/src/contracts/realtime/`, one file per namespace, events and scopes taken from today's `packages/shared-server/src/realtime/*.ts` and `packages/trpc/src/routers/{calendar,ratings,permissions,caldav}/types.ts`, payload schemas from `packages/shared/src/contracts/zod/*.ts` where they exist and `z.custom<T>()` with a one-line comment where they do not (list every `z.custom` in this ticket's Comments):

- `groceries.ts` (`grocery`): the eight events; `failed` moves to scope `user` — today it is household-scoped, so one member's validation failure toasts the whole household.
- `recipes.ts` (`recipe`): the events of `RecipeSubscriptionEvents` on scope `policy` where today's publisher goes through `emitByPolicy`, `household`/`user` otherwise; the five `share*` events become one `shareEvent { kind: "created" | "updated" | "revoked" | "reactivated" | "deleted"; share }`.
- `cookbooks.ts`, `ratings.ts` (`policy`), `stores.ts` (`household`), `calendar.ts` (`household`, plus one `internal` companion per event the CalDAV listener reacts to — see 05), `households.ts` (the `Household*EventSchema` schemas, the first domain with real runtime validation), `caldav.ts` (`user`; delete the duplicate type in `routers/caldav/types.ts`), `permissions.ts` (`policyUpdated`, `broadcast`; replaces the inline type at `routers/permissions/subscriptions.ts:10-16`), `archive.ts` (`user`), `recipe-enrichment.ts` (`recipeBecameUsable`, `internal`), `connection.ts` (`invalidate { userId, reason }`, `internal`).

**Domains** in `packages/shared-server/src/realtime/<domain>.ts`: one `defineRealtimeDomain(...)` line each; `connection-invalidation.ts` becomes `connection.ts` with an `emitConnectionInvalidation(userId, reason)` that awaits `connection.publish`.

**Publishers:** every call site in `packages/trpc/src/routers/**`, `packages/queue/src/**`, `packages/api/src/**`, `packages/auth/src/claim-processor.ts` and `packages/shared-server/src/accounts/deletion.ts` becomes `domain.publish(event, payload, target)` with an explicit `void` or `await`. Three behaviour fixes ride along: `packages/trpc/src/routers/archive/archive.ts:169` routes by policy like every other recipe create instead of unconditionally to the household; the four sites in `routers/households/households.ts` (`:147-152`, `:223/237`, `:293/297`, `:364-380`) `await` the household event before they `await` the invalidation, so the departing view receives it before its socket closes; the share mutations publish `shareEvent`.

**Procedures:** every `routers/*/subscriptions.ts` becomes a list of `realtimeSubscription(domain, "event")` lines (recipes' five share procedures become `onShareEvent`). The six `if (!ctx.household) { await waitForAbort(signal); return; }` guards in `routers/households/subscriptions.ts` go: a household-less user's household channel is `household:{userId}` and simply stays quiet.

**Deleted in this ticket:** `packages/shared-server/src/redis/{pubsub,subscription-multiplexer,channel-metadata}.ts` and their package exports; `packages/shared-server/src/realtime/policy.ts`; every `globalThis.__xEmitter__` emitter; `packages/trpc/src/emitter.ts`; `packages/trpc/src/routers/{calendar,permissions,ratings}/emitter.ts`; the realtime types in `routers/*/types.ts`; `createSubscriptionIterable`, `createEnvelopeSubscriptionIterable`, `createPolicyAwareIterables`, `createEnvelopeAwareSubscription` and `waitForAbort` in `packages/trpc/src/helpers.ts` (`mergeAsyncIterables` moves beside the factory if `realtime-resume.ts` uses it, otherwise it goes too); `ctx.multiplexer` in `packages/trpc/src/context.ts` and `getOrCreateMultiplexer` in `middleware.ts:45-47`; the seven emitter fakes in `packages/trpc/__tests__/mocks/`; `packages/trpc/__tests__/helpers.test.ts`. Every test that mocked an emitter uses `createFakeRealtimeDomain` from 03 and keeps its assertions.

**Blocked by:** 03.

**Spec:** `.scratch/realtime-foundation/spec.md` § Realtime Catalogue, § Domain, § Subscription factory

**Status:** ready-for-human

- [x] Twelve catalogue files; every `z.custom` listed in Comments
- [x] `grep -rn "createTypedEmitter\|TypedRedisEmitter\|__[A-Za-z]*Emitter__\|emitByPolicy\|createSubscription(\|getOrCreateMultiplexer\|waitForAbort" packages apps --include=*.ts` is empty
- [x] Every `routers/*/subscriptions.ts` contains only `realtimeSubscription` lines; 58 procedures become 50 (five share procedures → one, five CalDAV procedures → one; see Comments)
- [x] No floating publish promise: every `publish(` is preceded by `void ` or `await `
- [x] `grocery.failed` targets `{ userId }` (fake-domain test); every other event keeps its scope
- [x] Archive-created recipes route by policy (fake-domain test in `packages/trpc/__tests__/archive`)
- [x] Households: for create, join, leave, kick and admin transfer the fake domain's recorded call list has the household event before `connection.invalidate`
- [x] `households/subscriptions.ts` has no `!ctx.household` guard
- [x] Household publishes validate against the zod schemas; a malformed publish throws under test
- [ ] The web client still compiles and behaves as before through its existing shim (07 removes it); grocery, store, recipe, cookbook, calendar, household and CalDAV flows checked in a browser
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build` green

## Comments

- Implemented on `claude/realtime-foundation-tickets-db3b92` together with 05. Decisions and the deviations from the text above:
  - **CalDAV is one event, `syncEvent`**, whose payload is a discriminated union over `type` built from the six existing `Caldav*EventSchema`s, and one procedure, `onSyncEvent`. The one-line rule cannot express the old `onSyncEvent` (a merge of six channels) any other way, and ticket 07 keeps the client's single `onSyncEvent` subscription, whose `{ type, data }` wire shape is unchanged. The four single-fact procedures it also had (`onItemStatusUpdated`, `onSyncCompleted`, `onSyncFailed`, `onInitialSyncComplete`) are gone; the two web hooks that used them now filter `onSyncEvent` by `type` until 07 folds them away. Procedure count is therefore 50, not 54.
  - **The kicked user's `permissions.policyUpdated`** was a user-targeted publish of a broadcast event; the catalogue has one scope per event, so it is dropped. The kick invalidates that user's connection right after, and the reconnect refetches (Recovery, ADR-0011).
  - **`recipeBatchCreated` stays `household`-scoped** (the archive's batch announcement); the ticket's policy fix applies to the archive route, which now passes `{ viewPolicy, userId, householdKey }` like every other recipe create — the fake-domain test pins it.
  - **Calendar internal companions** are `itemCreatedInternal`, `itemDeletedInternal`, `itemMovedInternal`, `itemUpdatedInternal` (`calendarInternalCompanion` in the catalogue maps event → companion); `packages/trpc/src/routers/calendar/publish.ts` publishes both beside each other.
  - **`createFakeRealtimeDomain`** no longer imports the real domain module (it derives channels through the codec directly), so a test may stub the logger or the config however it likes; `packages/trpc/__tests__/mocks/realtime/<domain>.ts` are ready-made `vi.mock` targets.
  - Two shadowed locals the mechanical cutover exposed (`groceries` destructured from the input in `toggleGroceriesData`, `markAllDone` and `deleteDone`) are renamed; the trpc package's own `typecheck` runs `--noCheck`, so a full `tsc --noEmit` was run by hand on trpc, queue, api and auth (clean apart from pre-existing bullmq/better-auth errors).
  - The browser check of the flows is still open: this environment has no Docker daemon for Postgres, so it belongs to the release verification (ticket 10).
  - `z.custom` payloads, to replace with real schemas later (21): grocery `created`, `updated`, `recurringCreated`, `recurringUpdated`; recipe `created`, `imported`, `updated`, `converted`, `enrichment`, `recipeBatchCreated`; cookbook `created`, `updated`; store `created`, `updated`, `reordered`, `productUpdated`, `linkUpdated`, `aisleFiled`; household `created`; archive `archiveProgress`, `archiveCompleted`.
- 2026-09-21: the open browser check is superseded — the shim it refers to went with ticket 07. Browser coverage now comes from the E2E gate: groceries and households through `realtime/realtime.e2e.ts`, recipes, cookbooks, imports, enrichment and stores (aisles, prices) through the `ai` project, all on the rebuilt layer. Calendar and CalDAV have no browser suite and stay with the manual checks in ticket 10.

