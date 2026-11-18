# 45: Library switch, tags and swipe

**What to build:** A view switch that doesn't remount, tags that fit, Mail-style swipe. See spec Part 7 ("Recipes tab").

**Blocked by:** none

**Status:** ready

- [x] The grid/list switch is `ListSwitch`; it flips locally at once and saves the Device Preference in the background.
- [x] One key per recipe in both views (no `grid-${index}`); no entering animation replay on a toggle.
- [x] Grid tags: those that fit plus `+N`, glass over the photo. `TagStrip`, `useTagStrip`, `tag-strip-intent` and the swipe's `requireToFail` on them go.
- [x] Swipe actions fan out with the finger, each at its own rate; full swipe runs the first. Unit test for the offsets.
- [x] Gates green; checked on the device.

## Comments

- No "tags that fit" rule existed (web shows 2 then +N, the mobile list 1 then +N), so `fitTags` is new: chips are measured once in a hidden row, the grid uses it, the list keeps its first-tag rule.
- The view is `useLibraryView`: a module-scope pick shown at once and saved in the background, kept if the save fails; both views now render the same 8-card cells (`cell-N` keys, one key per recipe), so a toggle remounts nothing (`card-list.test.tsx`).
- Swipe: action `i` of `n` moves at `(n-i)/n` of the finger (first glued to the card, outer ones lag), one block under Reduce Motion; a full swipe is 80% of the *screen* (60% of a grid card was reached by Maestro's swipe and ran the first action).
- Device (iOS 27.2, Release): thumb visible in dark on the Library and Groceries; Planned item and Plan recipe sheets not checked there. The agent-device screenshot lags the last tap by a frame, so mid-motion shots are of the settled state. Reduce Motion can't be set through the device tools: covered by the unit test only. Cookbook page not walked (shares the header and list). `decay-to.ts` went with the tag strip.
- Review round 1 (Standards + Spec), dispositions:
  1. fix (bug): a full swipe needs 80% of the screen width (over 321 pt): unreachable on a left-column grid card (its right edge is at about 195 pt), and on the rest the finger must start in the last 60 pt. The threshold follows the row: its open width plus an overshoot, capped by the travel the card's position allows; a pure function with tests.
  2. fix: nothing announces the full swipe: past the open width the actions stop while the card moves on, leaving a gap, and no haptic marks the threshold. The first action fills the gap, with a haptic at the threshold.
  3. fix: `use-library-view.ts` keeps the pick in module state above `useDevicePreference`, which already writes optimistically: a refused save leaves screen and stored value disagreeing until restart, another device's change is ignored, the pick survives sign-out. The layer goes; its order-dependent test with it.
  4. fix (bug): cards are keyed per recipe inside cells keyed `cell-${index}`, eight list rows to a cell, so deleting a row moves the first card of every later cell and replays its entering animation. An entering animation plays only for a recipe new to the list; a test deletes a row.
  5. fix: the grid shows the tags that fit then `+N`; the list still shows its first tag then `+N`. One rule for both (`fitTags`): glass chips over the photo in the grid, plain chips in the list row. (The spec's "like the list's" assumed the list already did this.)
  6. fix (bug): the `+N` chip's width is stored under the key `"+"` beside the tag names, so a tag named "+" collides; when even the first tag does not fit the card shows only `+N` (the first tag is cut short instead); nothing checks `+N` fits.
  7. fix: `swipe-reveal.ts` `actionOffset` has a five-line doc comment; `isGrid`, `panelWidth` and `count` are threaded through `SwipeActions`, `ActionsPanel` and `ActionButton`; unnamed numbers (`GAP = 6` coupled to `left-2`/`px-2`, `size-11`/`size-12`, `19`/`20`); `pill.tsx`'s `RADIUS` beside the `BOX` classes; `onSwipeableCloseStartDrag={() => startDrag()}`.
  8. fix: no test for a full swipe running the first action, the threshold haptic, or the chips waiting on their measurement.
  9. fix (verify): `onSwipeableWillOpen` calling `close()` while the open still runs; `delete-recipe.yaml` swiping far enough to trigger a full swipe instead of opening the actions.
  10. device check still owed: the dark thumb on Planned item and Plan recipe, the cookbook page, Reduce Motion, grid chips over real photos (the shots show grey placeholders).
  11. reject: the Library calling `GlassSegmented` directly while Groceries goes through `ListSwitch`; it is one switch component.
  12. reject: the dark thumb being faint; it is the canvas's value (ticket 40 round 1 #2). Listed for Mike.
- Round 1 fixes: a full swipe is the open width plus 64 pt, capped at the card's right edge minus 64 pt, never under open + 32 (list row with 3 actions 280 pt, grid card 148 pt, left-column grid card 131 pt); past the open width the first action follows the card, a medium haptic marks the threshold each way, and the finger is tracked on the UI thread (a manual gesture) because under Reduce Motion the settle reached the open width before "will open" and cancelled the full swipe.
- Tags, one rule in both views (`fitTags`): the tags that fit, then `+N`; a first tag too wide is cut short so a card always names one, and `+N` is dropped when it would leave the first tag narrower than itself. Glass chips over the grid photo, plain chips after the facts in the list row.
- Dark thumb: present on Planned item, Plan recipe, Groceries/Pantry and the Library, at rest and right after a change (full-resolution crops); the earlier empty Planned item shot was not a fault, the thumb is only faint against some backdrops (round 1 #12).
- Device (iOS 27.2 Release, mike@mike.nl, photos from a scratch UPLOADS_DIR): slow swipe opens and full swipe runs Add to groceries once on left/right grid cards, a list row and a cookbook page (throwaway cookbook, removed), with Reduce Motion off and on. The list-view delete ran on Maestro's throwaway stack (delete-recipe 3/3), as the editor would not create a throwaway recipe here.
- Exit gate on `15912a92e`: all seven gates exit 0 (before round 2's fixes).
- Review round 2 (the fix range), dispositions:
  1. fix: the threshold haptic has no hysteresis; a finger resting on the full-swipe line fires it on every 1 pt crossing.
  2. fix (bug): a card that a delete moves to another cell unmounts from its old one, where `exiting={SPRING_FADE_OUT}` plays a fading copy; only the deleted recipe exits. The delete test checks `entering` only.
  3. fix: every mounted card keeps a hidden copy of each tag chip, glass surfaces included, for measuring; the measuring row is plain and goes once measured.
  4. fix: the floor "open + 32" is `FULL_SWIPE_OVERSHOOT / 2`, not its own constant; two tags with the same name share a key and a width slot; no mobile test checks the view switch writes the preference.
  5. reject (low): the first frames of a card's first drag using 148 where 131 applies; a second finger resetting the full swipe; list tags appearing a frame after the facts; cells mounted later by virtualisation animating in.
- Round 2 fixes: #2 `579d11159` (the delete test now fails on moved cards exiting; a change first commits the old cells with only leaving cards set to exit), #4 floor `03d6f1e3e`, #1 `afb33c684` (`FULL_SWIPE_HYSTERESIS` 16 pt in `swipeZone`), #3 + #4 keys `af6233a09` (plain measuring row, unmounted once measured, re-measured on window width, font scale or tags), #4 view switch test `0e6533b38`. All seven gates exit 0. Device (iPhone 17, iOS 27.2 Release, local dev server, mike@mike.nl): list `chicken +3` plain, grid `chicken dinner +2` glass; slow swipe opens and full swipe opens Add to groceries once in both views (closed unchanged); no crash. Maestro delete-recipe and add-to-groceries pass first run.
