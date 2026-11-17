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

### Board differences fixed from the device run (2026-11-17)

- Fixed against the boards, light and dark where it is colour: Groceries empty card with Stores, 24 pt step badges and faded done chips, glance dividers and allergen chips, one-row Store colours, spaced grocery amounts (`formatSpacedAmountUnit`), by-recipe Store dots, "N recipes" on grouped rows, Share sheet link rows, calendar sheets and rows, video hero, cook mode (Next label fits, filled clock, timer rows), cookbook chips and details rows, red favourite heart, editor fractions and values, Pantry search ring, the glyphs, the Servings word, and the recipe menu order.
- Typed repeats: "every other friday" and "every second friday" (and the locales' words) are detected in the shared parser; web's field takes it too, and applying the pill already strips the words there as here.
- Followed web instead of the board: section order and totals by recipe, the calendar subtitle order, the country flag (web shows it in the details card only), the "# Cook" heading, Pantry names and "From your recipes" (open only while the Pantry is empty). Not done: the edit field's "1×" form (the parser would store "× name"), the Pantry food sheet's header icon (native sheet header).
- B1: a link dismisses an open sheet before it navigates (`+native-intent`). B2: a plan added above the shown days no longer moved Today in the run; the case where the added rows sit inside the visible days grows the list there, as it should.
- Top edge: a soft native scroll edge effect under the status bar on the recipe page, the cookbook page and every tab list; no bar or title.
- Calendar: the title row is the list's first row and scrolls away; a glass Today control sits above the accessory while today is off screen (also on a tap of the Calendar tab). Open: `calendar-drag` fails on the iPhone 17 after the title row moved into the list; the day it opens on lands at a slightly different height each launch, so the flow's percentage coordinates miss the row.

### Calendar opening, header and board follow-ups (2026-11-17)

- Calendar: the list mounted at the top and a content-size callback then scrolled to the day, so a flow or a glance could catch the first position; it now mounts at `openingOffset` (a day under the status bar, unit-tested) through `contentOffset`, once, and `calendar-drag` is retuned to the settled rows.
- Recipe header: the repeat was the seed's tags carrying the Categories' names; the line now names a Category once (web joins the same way and has not changed).
- Device fixes: pause is 72 pt and fullscreen sits under Back (the native header covers Back's row), Next keeps its label beside a timer pill, the Today glass is tinted so rows don't bleed through, the Servings word shares the number's baseline, the detected repeat pill's border reads in dark.
- Seen fine: cook subtitle, filled timer chip, Pantry search ring, eight Store swatches in one row, done step's faded chips, the soft top edge on Calendar and Pantry.
- Open: "Every other weeks on Friday" (the plural unit after "every other") is in the shared formatter; the locales differ on the unit's number, so it needs a key per locale. A long step in cook mode keeps its chips below the visible text until it is scrolled.
- Maestro on the iPhone 17: `calendar-drag` 3 of 3, `calendar-plan-accessory`, `calendar-remove`, `planned-item-edit`, `cook-mode`, `groceries-add-repeat` once each pass. `calendar-offline` fails since the title row moved into the list: the Offline pill sits in that row, which the Calendar opens scrolled past, so the flow cannot see it. Open question for Mike: keep the pill in the scrolling title row (and have the flow reach it) or show it where it stays in view.

### Recipe media server fixes (2026-11-17)

- Photos lost after create: `recipes.create` answered its id before the recipe was stored, so an upload in that window took the pending-recipe path, returned success and was never linked (no row, no Dish Colour). Create now answers once stored (9a406f21b); an API client or a photo added on the page right after saving could hit it. The lost files are unreferenced and the orphaned-media cleanup removes them.
- No realtime after media writes: gallery image and video uploads and removals now publish `updated` with the stored recipe, as edits do (050c181a3); reorders already went through `recipes.update`.

### Whole-branch review fixes (2026-11-17)

- Offline and server: a queued v0.26.1 `calendar.updateItem` is read as `calendar.editItem` where the Outbox loads its entries (73419f629; no other procedure was removed or renamed since v0.26.1-beta, and the delayed-delivery allowlist already names `editItem`). Slot writes lock the planner's user row first, so two moves or a move and a create or delete no longer deadlock (b38981f67). A replayed `recipes.create` whose id the same owner already stored answers that recipe; another owner's id stays an error (0fb480a19). Work after a create is stored only logs, with no `failed` event (334be48ed). A gallery upload for a recipe whose create is still running waits for it on the server (028f74071), and the shared upload hooks hold an upload until the recipe's create is answered (831579ce9). A stale gallery delete removes neither row nor file (dabcc1caf).
- Mobile: the tab bar guess resets to expanded when a tab regains focus (8607131c1); one tab bar geometry in `lib/tab-bar-placement.ts`, list end inset = expanded accessory top + 24 pt, pure modules moved to `lib/` (341945d07); one `labelFits`, hidden until measured (c7267a74b); the cookbook's Add recipes is a plan entry with its own key (220f992de); Reanimated only through `lib/motion` (1af9570fb); `createMark` for tab bar counts and timer answers, notification taps keep one id (bdd27e32e); white icons use `accent-foreground` (165be2d5e); the Pantry field is `SheetSearchField` with `ring` (955b485fb); comments at most two lines (c0ceb18cb).
- Shared: a tag repeating a Category is dropped by the stored Category name, on web's recipe header too (219213a19). Repeat summaries are ICU plural messages per rule in every locale, and Danish and Norwegian full weekday names now start on Sunday (00174737c).
- Simulator (iPhone 17, Release): the first build crashed after sign-in because the React Compiler memoised `answers.use()` as a value; mark hooks are now called through `use`-named bindings (ffb2272c8). The web recurrence test reads through `useTranslations`, as `next build` typechecks tests (023a90399). Then `cook-mode`, `recipe-controls`, `calendar-plan-accessory`, `cookbook-create-add` and `planned-item-edit` passed once each.
