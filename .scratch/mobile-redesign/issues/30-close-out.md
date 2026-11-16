# 30: Maestro, docs and release notes for Recipe, Groceries and Calendar

**What to build:** The three areas' acceptance run and their docs. See `.scratch/mobile-redesign/spec.md` Parts 3–6 ("Testing Decisions").

**Blocked by:** 29, 31, 32, 33, 34, 35, 36, 37, 38

**Status:** open

- [ ] Maestro flows from Parts 3–6's Testing Decisions; one full run after 18–29 and 31–38 are reviewed and fixed; each new flow run repeatedly to prove it stable.
- [ ] The grocery realtime check returns.
- [ ] Device run of every new board against the canvas.
- [ ] Docs pages for the Recipe screen and timers, Groceries and Calendar, and the widgets page stating that widgets update when Norish runs; release notes for 0.27.0-beta.

## Comments

### Known limits noted during tickets 23-27 (2026-11-15)

- Predicted versions (groceries, stores, planned items): the client bumps a cached version on each optimistic write so the user's own writes in a row land. If the first queued write is refused and another member's change produces exactly the version the second write predicted, the second lands over theirs (a field or a position, not a whole list). The fix is the server applying such writes field by field without a version check, which ADR-0004 considered and deferred. Mike, 2026-11-15: fine for now, keep it noted.
- Mobile has no screen for Parked or Conflicted Outbox entries; they stay and count in sign-out's "N changes". Mike, 2026-11-15: fine for now.
- Grocery writes waiting behind a stalled request reach the Outbox one 20-second timeout apart; an app kill in between loses the ones not yet sent.
- A recipe edit that may already have reached the server, followed by another edit of that recipe, may be refused with the toast (accepted, ticket 23).

### Whole-branch review fixes (2026-11-15)

- A failed `recipes.update` rejects (no `failed` event); work after the commit only logs; web's editor stays open with the error until the save is stored or queued. Replay retries a 5xx and parks a refusal (tests).
- The Recipes stack anchors on its list; the recipe page has Back in every state, a missing recipe included.
- A dropped step or ingredient row is read by id against the current rows (mobile and web), so a photo finished mid-drag is kept.
- Store update, delete and reorder share the `store-writes` scope; every scoped write (groceries, stores, calendar, device preferences) has the 20-second send timeout.
- expo-notifications no longer declares remote push (`aps-environment` gone from the prebuilt entitlements; Live Activity, App Group and Share Extension unchanged).
- Photo and camera permission strings name recipe photos; comments trimmed to two lines; eslint-disable reasons; one route map (`tab-routes.ts`); one serial queue for timers and widgets; `isRead` on the Pantry; web's grocery grouping memo removed.
- Simulator (iPhone 18 Pro, iOS 27.2, Release build with both extensions, own server on :3400, throwaway Postgres and Valkey): cold recipe, cook-mode and missing-recipe links all go back to the Recipes list with the tab bar; a step photo whose upload finished while its step was held stayed on that step and was stored; a Store rename then an immediate reorder both stored.
