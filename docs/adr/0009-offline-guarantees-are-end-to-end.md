# Offline guarantees are end-to-end

## Status

Accepted follow-up specification — **not implemented** as of July 22, 2026. ADR-0001 through ADR-0008 remain unchanged historical records of the implemented design. This document records the next change and identifies which earlier decisions will be superseded only when that change is implemented.

## Problem Statement

The offline implementation has the right foundations but several guarantees currently stop at an internal boundary instead of reaching the user. A mutation can be presented as Queued before IndexedDB has accepted it; `FormData` is not itself structured-cloneable; an unseen App Router route can reach a provider-free fallback instead of the user's Warm Set; primary image URLs are warmed as data without warming the image responses; grocery merging can replace a client id without repairing queued dependents; and account transitions can silently discard queued intent. The implementation also has a tRPC declaration portability error, new unsafe test casts, and no browser test proving the service-worker behaviour.

## Solution

Make each offline promise observable end to end. Queued means durably stored. Supported upload inputs round-trip through the Outbox. The Warm Set boots on supported unseen routes and includes each warmed recipe's primary image. Grocery merging remains authoritative while returning a generic client-to-canonical id mapping that Replay applies to dependents. Sign-out gives the user a guided destructive choice, while bypassed identity changes retain the old queue dormant. The implementation is considered complete only when the package typechecks and production service-worker behaviour passes browser tests.

## User Stories

1. As a household member, I want a Queued confirmation only after my change is durably stored, so that the app never claims to have saved work it lost.
2. As a household member, I want an upload started during an outage to retain its text fields and files, so that Replay sends the same mutation later.
3. As a household member, I want a failed Outbox write to be shown as a failure, so that I can retry instead of trusting a false success.
4. As a household member, I want to add a grocery and immediately edit or complete it while Offline, so that common create-then-edit flows remain usable.
5. As a household member, I want matching groceries to merge, so that Offline support does not create duplicate shopping rows.
6. As a household member, I want concurrent matching groceries from another client to merge correctly when I reconnect, so that stale local knowledge does not weaken server behaviour.
7. As a household member, I want changes queued behind a merged grocery create to target the canonical grocery, so that no follow-up is stranded on an optimistic id.
8. As a household member, I want to open the dashboard directly while the backend is down, so that an unseen document route still boots the app.
9. As a household member, I want to open warmed recipe details directly while the backend is down, so that the promised recipes are actually available without a prior route visit.
10. As a household member, I want to open groceries and calendar directly while the backend is down, so that the rest of the Warm Set has the same guarantee.
11. As a household member, I want a clear Offline-unavailable view for unwarmed recipes and unsupported routes, so that missing data is not presented as an empty or broken app.
12. As a household member, I want the primary image of every warmed recipe to appear Offline, so that recipe cards and details keep their essential visual context.
13. As a household member, I want gallery, step, and video media to remain best-effort, so that the Warm Set has a predictable storage bound.
14. As a signed-in user with unsynced work, I want sign-out to explain the consequence and let me cancel, so that queued changes are never discarded accidentally.
15. As a user signing out deliberately, I want one clear Sign out action after the warning, so that the destructive choice is understandable.
16. As a user whose session changed in another tab, I want my old queue retained under my identity, so that an event outside the dialog cannot silently erase it.
17. As an incoming user on a shared browser, I want the previous account's reads and images hidden and its queue unable to Replay, so that household data and mutations never cross accounts.
18. As a maintainer, I want the offline contracts expressed through shared modules rather than duplicated rules, so that frontend prediction and server authority remain aligned.
19. As a maintainer, I want portable generated tRPC declarations and tests without unsafe casts, so that the package typecheck is a meaningful release gate.
20. As a maintainer, I want backend-down browser tests, so that service-worker, Cache Storage, navigation, and Replay claims are proven in the environment where they run.

## Implementation Decisions

- Outbox admission uses an explicit input codec. A direct `FormData` input is encoded as an ordered list of string or file entries in a tagged, IndexedDB-safe value and reconstructed as `FormData` immediately before transport. Duplicate keys and entry order are preserved. `File` and `Blob` values retain their browser-supported structured-clone metadata.
- The mutation link waits for the IndexedDB transaction. Successful persistence produces the Queued outcome. Persistence failure produces a real mutation failure, rolls back optimistic state where applicable, and presents actionable error feedback.
- Grocery create retains its array contract for manual and batch additions. Every submitted grocery requires a client-minted UUID; ID-less legacy creates are removed.
- One pure grocery merge definition is shared by the frontend and server. It preserves the existing normalized-name, origin, unit-compatibility, and amount-accumulation semantics.
- The frontend uses cached groceries to select a known canonical id and apply the common optimistic merge. The server repeats the same rule against authoritative state and may select another canonical id after stale or concurrent work.
- Grocery create returns one client-to-canonical id result per submitted item in input order. Replay stores substitutions and rewrites exact matching UUID values in later queued inputs and dependency metadata. Replay remains generic and does not switch on a procedure name.
- The App Shell includes a small client bootstrap router under the normal providers. It supports unseen dashboard, warmed recipe-detail, groceries, and calendar routes. It renders explicit Offline-unavailable states for unwarmed recipe ids and unsupported routes.
- The Cache Warmer explicitly fetches each available canonical primary image for the 50 full Warm Set recipes into the existing bounded image cache. Media failures are isolated. Gallery images, step images, and video media are not proactively warmed.
- Explicit sign-out with a non-empty active Outbox opens a basic HeroUI dialog with guiding text and Cancel / Sign out actions. Sign out discards the active queue and personalized caches only after confirmation. Cancel changes nothing.
- Identity transitions that bypass explicit sign-out immediately isolate the incoming account but retain the outgoing Outbox dormant under its owner. Dormant entries can Replay only after that owner signs in again.
- Authenticated application mutations keep the generic operation-id middleware. Admin procedures are unchanged because the admin surface is not supported Offline.
- The tRPC declaration portability failure is fixed with portable named boundary types rather than inferred declarations that expose a package manager's private dependency path.
- Newly introduced unsafe test casts are replaced with typed fixtures or contract helpers. No `as any`, `@ts-ignore`, or `@ts-expect-error` is introduced to close these findings.
- Historical ADR files remain unchanged. This follow-up record and the HTML summary carry the explicit supersession map so implemented history and future work remain distinguishable.

## Testing Decisions

- The highest acceptance seam is a production-built browser controlled with Playwright while the backend is genuinely unavailable. Tests exercise the installed service worker, real IndexedDB, Cache Storage, document navigation, and the app providers together.
- A Live warm followed by direct backend-down navigation verifies the dashboard, a warmed recipe detail, groceries, and calendar without first visiting those routes. A recipe outside the Warm Set and an unsupported route verify the explicit Offline-unavailable state.
- Browser coverage verifies that a warmed recipe's primary image renders from Cache Storage while the backend is unavailable. It does not require gallery, step, or video media.
- Browser coverage verifies explicit sign-out with unsynced work: Cancel preserves session and queue; Sign out discards the active queue and completes sign-out. A bypassed account change verifies that the old queue is dormant, old reads are not shown, and no entry replays under the incoming identity.
- Browser or integration coverage exercises a stale grocery merge: another client creates the canonical grocery after the first client's cache becomes stale; the stale client queues a matching create and a dependent edit; Replay produces one merged grocery and applies the edit to its canonical id.
- Focused Outbox contract tests cover `FormData` encode/decode, duplicate field names, files, enqueue success, quota/transaction failure, and Replay reconstruction. These tests assert observable values and outcomes rather than codec internals.
- Focused grocery contract tests run the shared matcher against frontend and server fixtures, verify batch ordering and many-to-one mappings, and verify substitution in later queued inputs.
- Existing cache-warmer, Replay, identity-controller, grocery hook, grocery router, and service-worker-adjacent tests are extended rather than creating parallel test harnesses.
- Release gates include the focused test suites, web and tRPC typechecks, the production web build, the browser suite, formatting, and `git diff --check`. Passed, failed, and environmentally blocked checks are reported separately.

## Out of Scope

- Admin procedure idempotency and Offline admin pages.
- ID-less legacy grocery create callers.
- Proactive warming of gallery images, step images, videos, settings, admin, edit, or import routes.
- Arbitrary unseen-route support beyond the Warm Set surfaces.
- Multi-day local-first operation, cache-at-rest encryption, or a bespoke client domain database.
- Field-wise conflict merging; ADR-0004 remains first-writer-wins.

## Further Notes

- This record specifies follow-up work only; its presence does not claim that the implementation is complete.
- Once implemented, its standardized Replay substitution replaces ADR-0003's rejection of all id rewriting, and its account-transition flow replaces ADR-0005's sign-out and unconditional-purge rules. The historical records themselves remain unchanged.
- The user-visible guarantee is deliberately smaller than "the entire app works Offline": unseen navigation is guaranteed for the Warm Set surfaces, while other visited routes remain best-effort Serwist cache hits.
