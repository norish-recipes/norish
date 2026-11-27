# Offline guarantees are end-to-end

## Problem Statement

An offline promise holds only if it reaches the user-visible boundary. A mutation shown as Queued before IndexedDB accepted it, an upload the Outbox cannot reconstruct, an unseen route that misses the provider-backed Warm Set, a warmed recipe without its primary image, or an account switch that briefly renders the outgoing account's cached data each break the promise while the foundations underneath are sound.

Norish needs to tolerate short outages and flaky connections; it does not need a complete local-first grocery model.

## Solution

Make the small offline promise reliable end to end. Queued means durably stored, supported upload inputs round-trip through the Outbox, unseen Warm Set routes boot through the normal providers, warmed recipes include their primary image, and account transitions isolate cached data before rendering the incoming account.

For groceries, support the two common short-outage actions: creating groceries and checking existing groceries off. The server's duplicate merge stays authoritative, with no client/server merge parity, canonical-id substitutions, or Replay input rewriting. A follow-up change to a just-created offline grocery can fail if the server merges that create into another row; this is an accepted limitation (ADR-0003).

## User Stories

1. As a household member, I see Queued only after my change is durably stored.
2. As a household member, an upload queued during an outage replays with the same fields and files.
3. As a household member, a grocery create or check-off rolls back and shows an error if Outbox admission fails.
4. As a household member, I can add groceries and check existing groceries off during a short outage.
5. As a household member, I can open the dashboard, groceries, the Pantry, calendar, and warmed recipe and cookbook pages while the backend is unavailable.
6. As a household member, an unsupported or unwarmed route shows an explicit Offline-unavailable state.
7. As a household member, warmed recipe primary images remain available Offline.
8. As a signed-in user, I receive a warning before sign-out discards queued work.
9. As an incoming user on a shared browser, I never see or Replay the previous account's cached data or queue.
10. As a maintainer, I have browser coverage for the service worker, IndexedDB, Cache Storage, navigation, and Replay behaviour.

## Implementation Decisions

- Outbox admission encodes direct `FormData` as an ordered IndexedDB-safe value and reconstructs it immediately before transport. Duplicate keys, entry order, and browser-supported file metadata are preserved.
- The mutation link waits for IndexedDB. Persistence success produces Queued; persistence failure remains a real mutation error. Grocery mutations restore their optimistic state and use the platform error adapter for visible feedback.
- Grocery creates use client-minted ids (ADR-0003); the server's merge stays authoritative.
- Replay does not maintain client-to-canonical id mappings and does not rewrite later queued inputs. Creating and then editing or checking a still-unsynced grocery that the server merges is outside the guarantee.
- A provider-backed bootstrap supports unseen dashboard, warmed recipe-detail, warmed cookbook, groceries, Pantry, and calendar routes. Other unseen routes render Offline-unavailable.
- The Cache Warmer fetches the primary image for each full Warm Set recipe into the same bounded Serwist cache and updates the cache's expiration metadata. Gallery, step, and video media remain best-effort.
- Explicit sign-out with a non-empty Outbox asks for confirmation. Confirming discards the active queue and personalized caches; canceling changes nothing.
- Bypassed identity transitions retain the outgoing queue dormant under its owner. Rendering is gated until the authenticated cache owner is reconciled, and Replay verifies its live session owner (ADR-0005).

## Testing Decisions

- Production-built Playwright coverage exercises the installed service worker while the backend is genuinely unavailable.
- Browser coverage includes direct Warm Set navigation, Offline-unavailable routes, primary images, queued Replay, sign-out, and account-transition isolation.
- Focused tests cover `FormData` encode/decode, durable admission failure, Replay classification, account-owner gating, grocery admission rollback, and image-cache expiration bookkeeping.

## Out of Scope

- General multi-day or local-first editing.
- Guaranteed create-then-edit or create-then-check chains when an offline grocery is merged by the server.
- Client-side prediction of the server's grocery merge rule, canonical-id substitution, and Replay input rewriting.
- Field-wise conflict merging.
- Admin Offline support.
- Proactive warming of gallery images, step images, videos, settings, admin, edit, or import routes.
- Arbitrary unseen-route support beyond the Warm Set surfaces.
- Cache-at-rest encryption or a bespoke client domain database.

## Further Notes

- This decision deliberately keeps the user-visible promise smaller than “the entire app works Offline.” It targets short backend outages and flaky connectivity.
