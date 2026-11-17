# 30: Maestro, docs and release notes for Recipe, Groceries and Calendar

**What to build:** The three areas' acceptance run and their docs. See `.scratch/mobile-redesign/spec.md` Parts 3–6 ("Testing Decisions").

**Blocked by:** 29, 31, 32, 33, 34, 35, 36, 37, 38

**Status:** open

- [ ] Maestro flows from Parts 3–6's Testing Decisions; one full run after 18–29 and 31–38 are reviewed and fixed; each new flow run repeatedly to prove it stable.
- [x] The grocery realtime check returns.
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

### Maestro flows written (2026-11-17)

- New flows, each run three times in a row on the iPhone 17 (iOS 27.2, fresh Release build of a0918939c) with no failure: `recipe-scale`, `recipe-write-yourself`, `recipe-edit`, `cook-mode`, `groceries-add-repeat`, `groceries-tick-clear`, `groceries-drag`, `groceries-drag-aisle`, `stores-manage`, `stores-reorder`, `pantry-filter-remove`, `groceries-offline`, `groceries-realtime` (the realtime check that Part 2 deferred), `calendar-plan-accessory`, `calendar-drag`, `calendar-remove`, `calendar-offline`. The Part 6 flows were left as they are; the existing flows were not run.
- Drags are a `swipe` from the row's coordinates with `duration: 10000`: the finger stays under the touch slop for the half second that lifts the row, then carries it across the next heading. The coordinates come from the list's layout on the iPhone 17 and are percentages of the screen.
- The harness gained a run count (`pnpm maestro <flow> 3`), control routes for groceries, Stores, aisles, plans and Pantry foods, and a reset that also clears Stores and planned items. No app code or test id changed, and no app fault turned up.
- The first box stays open: the one full run of the whole suite is still to come.

### Device-run app bugs fixed (2026-11-17)

- A recipe link while a recipe is open rebuilds the Recipes stack with the new recipe on the old route's key, so the shown-recipe mark now follows an id change on its own route; Cook shows after a link over a recipe, over cook mode, from another tab and on a cold start.
- Cook mode's peeks are clipped to two lines of text, so each stays in its slot; a long step's chips scroll into view in the step's own area. Drag, flick, peek taps and the long step were checked.
- A tab switch holds the bar expanded through the switch (UIKit keeps one minimised state for all tabs and only tracks a newly mounted list after a reselect); a sheet hides the bar only while it is in front, so one left open on Recipes no longer hides it on other tabs.
- The Calendar takes a change to the rows above the shown days without sliding rows, so `maintainVisibleContentPosition` keeps Today in place when plans above it go.
- The grocery sheet opens a step once the keyboard is down; Repeat from the Add sheet had stayed clipped to the form's keyboard-era height.
- Share sheet: Revoke was already an accessible button and the list already ends above Create link (the clipped row's AX frame overlapped it); Create link, Copy and Open now read their labels without a leading comma.
- Open: a link to another recipe while a recipe's sheet is open shows that recipe inside the sheet's presentation without the tab bar; adding plans above the shown days over realtime still pushes Today down.
- iPhone 17 Release build; `cook-mode`, `recipe-controls`, `groceries-add-repeat` and `calendar-remove` passed once each. Before/after frames are in the scratchpad `t30/fixA/`.
