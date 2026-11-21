# 17: Maestro, docs and release notes for the Recipes tab

**What to build:** The Recipes tab's acceptance run and its docs. See `.scratch/mobile-redesign/spec.md` Part 2 ("Testing Decisions").

**Blocked by:** 16

**Status:** done

- [x] Maestro flows: browse and filter, plan from Today, plan from a card, add to groceries, cookbook create and add, import from a link, delete, Recipes offline.
- [x] One full Maestro run after tickets 08–16 are reviewed and fixed; each new flow run repeatedly to prove it stable.
- [x] Offline replay (Outbox) and realtime coverage return on Recipes flows, replacing the smoke-screen flows ticket 08 removed; the grocery check returns with the Groceries area.
- [x] Device run of every Recipes board against the canvas.
- [x] Docs (the mobile app page in `apps/docs`, iPhone screenshots of Recipes and the Share Extension) and the 0.27.0-beta release notes line, written by Terra.
- [x] Gates green.

## Comments

### Maintainer feedback on the Recipes tab (2026-11-14), done 2026-11-14

Mike, on the simulator. One fixer takes all five once ticket 16's fix round frees the checkout and the device.

1. Today: the slot tags (Breakfast, Lunch, Dinner, Snack) at the top left of each slot are not fixed in place; they move as the page scrolls.
2. The global header (the "Recipes" title with the user's avatar) does not need to follow the scroll: it stays at the top of the page and scrolls away with it. Today, scrolling down animates "Recipes" to a centred title in a faded bar; neither should happen (no collapsing title, no bar appearing over the content). Not the "Your recipes" row.
3. The long press opens faster.
4. A long press shows the swipe actions for a moment as the menu opens and as it closes.
5. Tags and chips are plain white, so on a sheet that can be pulled to full height they match the sheet's background and lose their contrast; the same on the mini calendar and the other sheets that can be enlarged. They take a fill that reads on the glass sheet and on the full-height one (as ticket 15 did for a sheet's secondary action).

Done on the simulator (captures in `device-feedback/`):

1. Slot tags: the native glass host lagged behind the page's vertical scroll, so the tag drifted off its corner; `PhotoChip` is now a plain view (RN white 85% pill) that moves with its slot. Glass on those two chips is gone.
2. Header: the title and avatar were a native transparent header plus a collapsing title; they are now list content on the Recipes screen (native header off for that screen), so they scroll away. Groceries, Calendar and Settings have no header, so nothing to change there.
3. Long press: not changed. It is iOS's own context menu (`Link.Menu`), its delay is fixed by the system and the package exposes no option.
4. Swipe actions showing on long press: the actions panel sits behind the card and showed through it while the card lifted; the panel is now clear until the swipe progress is above 0 (grid and list checked).
5. Sheet controls: chips, day cards, rows, fields, tiles, stepper and the grocery section take `bg-default` instead of `bg-surface` (inner icon circles and photo placeholders swapped the other way); checked on every Recipes sheet at both heights, light and dark. Page chips (lenses, Filters, card pills) are white on the cream page and show no problem.

### New cookbook (Mike, 2026-11-14), done 2026-11-14

The device run found New cookbook built as a sheet where the board draws a centred alert. Mike: keep it a sheet, and make it web's panel: one drawer where the cookbook is created and its recipes are set. Queued behind the board-differences fixer.

Built: New cookbook is one two-detent sheet with the name, the recipe picker (search, ticked list, count as the subtitle) and Create pinned; `useNewCookbook` and `useRecipePick` are in shared-react and the picker's search and list are shared with Add recipes. Web's create panel takes only a title and files recipes afterwards from the cookbook (a separate panel), so this is mobile's own flow. A queued create is safe: `createCookbook` mints the id on the client and the create mutation already takes `recipeIds`, so one write carries both. Add to cookbook still stages a new cookbook inline in its own sheet and does not open New cookbook.

### Maestro flows (2026-11-14)

Ten flows in `apps/mobile/maestro/`: `recipes-browse-filter` (lenses, list/grid, tag filter, Clear filters), `plan-from-today`, `plan-from-card` (swipe, mini calendar; both pass through the Add to groceries sheet that planning opens), `add-to-groceries` (server has the lines), `cookbook-create-add` (New cookbook sheet, then Add recipes), `delete-recipe`, `import-from-link`, `recipes-offline` (cold launch with the server cut), `recipes-offline-replay` (import queued while cut: pending card, kept over a relaunch, one recipe after the server returns) and `recipes-realtime` (a recipe saved on the server appears live). The grocery check returns with the Groceries area.
Each flow resets and seeds the throwaway account over the script's control port (`/reset`, `/recipe`, `/count`, `/groceries`); the import page is a small JSON-LD page the script serves on loopback (nothing existed in the web E2E that fits: its recipe site needs https and a browser), and the throwaway server runs with `ALLOW_PRIVATE_ADDRESSES`. Each flow ran alone five times and the full set twice, all green (19/19 and 4/4).
No app code changed. Found: in grid view with a short Library the Delete swipe circle sits under the Add recipe accessory and cannot be tapped, so `delete-recipe` uses the list; not fixed here (a layout call). Left for the device pass: the other two boxes.

### Review log (2026-11-14)

Range `523b4f636..f13cfa132`, after the whole-branch review of tickets 08-16 (Standards on Sonnet low, Spec on Opus high, GPT-6.1 Sol on high; its seven findings fixed in `e39eb29f9..523b4f636`). Ticket 17's own review: Standards on Sonnet low, Spec on Opus medium; fixes `40fa23b5f..a0915b1fc`, docs fixes by Terra `c6e905dd4..5cda57f47` and `f13cfa132`.

Device runs against the boards, two passes (the second on the throwaway Maestro stack for states that need other data). Fixed: the missing bottom fade on the Recipes list and the cookbook page; the lens row past the margin on Cookbooks; the tab bar's dim tint in dark; one rule for an applied filter (favourites and minimum rating were not counted, on web too); a swiped card's actions under the Add recipe accessory in a short grid; a pending link import's host line; a failed import's reason in the toast (web too); the empty cookbook's spacing. Kept, as decided: native alerts and menus, the native tab bar's and grabber's sizes, the Library heading following the lens (as on web), Today opening on the next meal (spec), empty states without subtext, straight apostrophes in English.

Fixed from the review (18): a refused cookbook write failing without a word (now a toast for every cookbook write, on web too); a cookbook created Offline whose card and page disagreed; a test for a queued create carrying its recipes; the two planning flows' dependence on the clock; repeated flow steps moved into subflows; the not-a-recipe flow's hard-coded copy; one recipe pick sheet for New cookbook and Add recipes; named fade heights; harness tidying; stale comments; release notes for four changes to web's behaviour; the cookbook menu's wording and how a cover is set in the docs.

Rejected (3): the straightened apostrophe (it is the English messages' convention); two server strings mapping to one translation key (the reviewer calls it acceptable); the list also owning the swipe's reveal scroll (it must live where the list's ref is). Accepted: `seedCookbookMembers` uses `useCallback` like the seven helpers beside it in `use-cookbooks-cache.ts`.

Not seen on a device: the "+1" badge and the note card on a full Today; the Breakfast and Lunch slots once their meal has passed; the camera tile and the copied-link row (simulator); the Share Extension's too-old, AI-off and generic failure lines. The planning flows were not run across 10:00, 14:00 or midnight (the simulator's clock is the Mac's).

Not run: web E2E, by the maintainer's decision. The branch changed web behaviour in the applied-filter rule, the failed-import toast, cookbook failure toasts, Replay's retry of 408 and 429, and the shared import hooks; unit tests cover them.

Final state `a0915b1fc` (plus the docs-only `f13cfa132`): all 11 gates exit 0, mobile lint has no warnings; the Maestro suite passed twice.

Mike, 2026-11-14, closing the open items: Add to cookbook keeps creating its cookbook inline; the Share Extension docs screenshot over a real recipe page stays; the canvas keeps its 40 pt toast icon and its New cookbook alert, and the app's versions stand.
