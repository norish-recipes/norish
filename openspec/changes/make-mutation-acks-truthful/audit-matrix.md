# Mutation Acknowledgement Audit Matrix

Executable form: `packages/trpc/__tests__/delayed-delivery-allowlist-accuracy.test.ts` (walks `appRouter`, fails on unclassified mutations or growth of the fire-and-forget set). This document adds the reasoning. Snapshot date: 2026-07-09, 95 mutations.

## Classification key

| Column | Values |
| --- | --- |
| Ack class | `awaited` (write awaited before response) \| `fire-and-forget` (returns success before its own write) \| `enqueue` (acknowledges acceptance of long-running work only) |
| Target | `awaited-standard` (convert/keep on `MutationAck`) \| `enqueue-contract` (explicit accepted/queued response) \| `exception` (documented deviation) |
| Receipts | Idempotency-receipt eligibility for `add-idempotency-receipts`: `wave-1` (creates), `wave-2` (existing allowlist), `no` |

## Fire-and-forget conversion targets (20)

| Mutation | Ack class today | Target | Receipts | Notes |
| --- | --- | --- | --- | --- |
| `groceries.update` | fire-and-forget | awaited-standard | wave-2 | `.then()` chain; stale handled async today |
| `groceries.reorderInStore` | fire-and-forget | awaited-standard | wave-2 | reorder + preference save in chain |
| `groceries.markAllDone` | fire-and-forget | awaited-standard | wave-2 | snapshot-based |
| `groceries.deleteDone` | fire-and-forget | awaited-standard | wave-2 | snapshot-based |
| `groceries.updateRecurring` | fire-and-forget | awaited-standard | wave-2 | dual version (recurring + grocery) |
| `groceries.detachRecurring` | fire-and-forget | awaited-standard | wave-2 | dual version |
| `groceries.deleteRecurring` | fire-and-forget | awaited-standard | wave-2 | |
| `groceries.checkRecurring` | fire-and-forget | awaited-standard | wave-2 | explicit `isDone` |
| `recipes.create` | fire-and-forget | exception | no* | must await write; keeps bare uuid `string` return until a breaking-change window (*receipt-eligible once return shape can change) |
| `recipes.update` | fire-and-forget | awaited-standard | wave-2 | |
| `recipes.delete` | fire-and-forget | awaited-standard | wave-2 | file delete + DB delete in chain |
| `recipes.convertMeasurements` | fire-and-forget | awaited-standard | wave-2 | long `.then()` chain |
| `stores.delete` | fire-and-forget | awaited-standard | wave-2 | store version + grocery snapshot |
| `ratings.rate` | fire-and-forget | awaited-standard | wave-2 | first conversion; proves the recipe |
| `households.create` | fire-and-forget | awaited-standard | no | cache invalidation must be awaited |
| `households.join` | fire-and-forget | awaited-standard | no | mutable join-code lookup; stays immediate-only for delivery |
| `households.leave` | fire-and-forget | awaited-standard | wave-2 | connection termination stays deferred post-response |
| `households.kick` | fire-and-forget | awaited-standard | wave-2 | emit-to-kicked-user before termination, ordering preserved |
| `households.regenerateCode` | fire-and-forget | awaited-standard | wave-2 | |
| `households.transferAdmin` | fire-and-forget | awaited-standard | wave-2 | |

## Enqueue-contract mutations (12)

| Mutation | Ack class | Notes |
| --- | --- | --- |
| `recipes.importFromUrl` / `importFromImages` / `importFromPaste` | enqueue | await BullMQ producer (`queued`/`exists`/`duplicate`), return id(s) |
| `recipes.estimateNutrition` / `triggerAutoTag` / `triggerAutoCategorize` / `triggerAllergyDetection` | enqueue | await enqueue, `started` events follow |
| `archive.importArchive` | enqueue | validation awaited; import in-process background; formalize `{ success, status: "accepted", total }`; BullMQ migration is follow-up |
| `caldav.triggerSync` / `caldav.syncAll` | enqueue | repeat-work; sync runs in background |
| `admin.categorizeAllRecipes` | enqueue | bulk job trigger |
| `admin.restartServer` | enqueue | deferred `process.exit` after response by design |

## Awaited mutations (63)

Already await their own write (or perform no DB write) before responding; adopt `MutationAck` opportunistically when touched:

- **groceries**: `create`, `toggle`, `delete`, `assignToStore`, `createRecurring` — receipts: `create`/`createRecurring` wave-1, rest wave-2
- **calendar**: `createItem` (wave-1), `moveItem`, `updateItem`, `deleteItem` (wave-2; already return `{ success, moved?, stale? }`)
- **recipes**: `updateCategories` (wave-2); shares `shareCreate/shareUpdate/shareRevoke/shareReactivate/shareDelete`; media `uploadImage/deleteImage/uploadStepImage/deleteStepImage/uploadGalleryImage/deleteGalleryImage/uploadGalleryVideo/deleteGalleryVideo` (gallery deletes wave-2)
- **stores**: `create` (wave-1), `update`, `reorder` (wave-2)
- **favorites**: `toggle` (wave-2; returns `{ recipeId, isFavorite, stale }`)
- **user**: `updateName`, `uploadAvatar` (opaque FormData version exception), `deleteAvatar`, `deleteAccount`, `setAllergies`, `updatePreferences`; `apiKeys.create/delete/toggle`
- **caldav**: `saveConfig` (awaits own write; enabled-sync follow-up is intentionally deferred — the one awaited mutation with a justified floating follow-up), `deleteConfig`, `testConnection`, `fetchCalendars` (no DB write)
- **siteAuthTokens**: `create`, `update`, `remove`
- **admin**: registration/password/locale/AI/video config, auth providers (OIDC/GitHub/Google/delete/test), content config (indicators/units/recurrence/prompts/timer keywords), jobs (`retry`/`remove`/`updateRetention`), permission policy, scheduler months, restore default, `testAIEndpoint`

## Intentional post-response side effects (lint-disable register)

| Site | Justification |
| --- | --- |
| households connection termination | would sever the WebSocket transport carrying the response |
| `admin.restartServer` deferred exit | response must reach the client before the process exits |
| `caldav.saveConfig` enabled-sync kickoff | long-running sync; acceptance is not part of the config write |
| enqueue-class background work | classified above |
