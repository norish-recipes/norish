# 52: Plan block

**What to build:** One plan block (day strip, slot tabs, then day cards with a + per day, Today ringed in accent) used by Plan this recipe, Move, Planned item and Plan recipe, per boards plan, planRecipe, move (/private/tmp/claude-501/-Users-mike-Documents-norish/d38bec8b-911e-4dc6-bbb1-96fe9e0bbaac/scratchpad/boards). `move-fields.tsx` goes; Move takes the Plan layout.

**Blocked by:** 50, 51

**Status:** ready

- [x] Day strip (sand day chips, accent selected) and slot tabs (Segmented standard) from the kit.
- [x] Day cards: sand card, date heading, slot sections with icon + thumbnail rows, a solid + icon button per day.
- [x] Move, Planned item, Plan recipe and Plan this recipe all render the block; no copy of it elsewhere.
- [x] Tests for the date/slot choice the block emits; Maestro flows touching these sheets updated; gates green.

## Comments

- `PlanPicker` (strip + slot tabs) and `PlanDayList` (picker, then day cards) live in `plan-block.tsx`; `move-fields.tsx` is gone. Plan this recipe and Move use the list, Planned item and Plan recipe the picker alone, as the boards draw them.
- A day's "+" is now a solid accent icon button that plans (or, in Move, picks) that day in the picked slot; the native four-slot menu and `SLOT_SYMBOLS` are deleted. Plan this recipe gained the header Plan button (`recipes.actions.plan`) for the strip day and slot.
- The list's header height is a constant (`PLAN_PICKER_HEIGHT`) so `getItemLayout` stays exact; strip taps scroll the list to that day. Move's "+" label reuses `calendar.panel.planOnDay`.
- Maestro `plan-from-card` taps the slot tab, then the day's "+"; no key lost its last reader. Planned item's recipe row is still the old one (ticket 53).
- Review round 1 (Standards on Hydrogen, Spec on Opus after Mike stopped a slow Argon run), dispositions:
  1. fix (bug): Plan this recipe and Move open with the day strip and slot tabs scrolled out of view: the picker is the FlatList header (`plan-block.tsx:101`) and `initialScrollIndex`/keep-today scroll past it. The picker sits above the list, outside it, always visible (board: days, slot tabs, then the day cards); the offsets lose `PLAN_PICKER_HEIGHT`.
  2. fix: Move's "+" changes the draft date with no visible feedback; once the picker is visible the strip must show (and scroll to) the picked day whichever control picked it.
  3. fix: Today ring at full strength, per board `.card.ring{box-shadow:inset 0 0 0 2px var(--accent-text)}`; `day-card.tsx:110` uses `border-accent-text/55`.
  4. fix: `plan-from-card.yaml:37-38` taps the slot tab after the sheet scrolled to today; check every flow touching these sheets still reaches its controls after fix 1.
  5. fix: the icon-button mock is inlined in `move-planned-item-screen.test.tsx:42-49` and `plan-calendar-screen.test.tsx:37-44` (and heroui-native at `:33`); share them from `__tests__/mocks/plan-sheet.tsx`.
  6. fix: both `PlanDayList` callers (`plan-calendar-screen.tsx:38-43`, `move-planned-item-screen.tsx:40-45`) build the same "+" label; the block builds it from a name.
  7. fix: the `PlanDayList` doc (`plan-block.tsx:59-62`) says "+" scrolls the list; make it say what the code does after fix 1/2.
  8. fix (verify): `PlanDayList` inherits `onDateChange(day, fromChip)` though no caller uses `fromChip`; narrow it if so.
  9. fix: `DayCard` testIDs ignore the block's `testID` prefix (`day-card.tsx:108,121`); prefix them and update tests and flows.
  10. reject: Plan this recipe's "+" planning at once in the picked slot: the board labels it "Plan on {day}" and fix 1 keeps the slot tabs in view; the slot menu it replaced is gone per the board.

Round 1 fixes: the picker sits above the day list (offsets start at `DAY_LIST_TOP`, `PLAN_PICKER_HEIGHT` gone, test added); `PlanDayList` takes a `name` and builds the "+" label, and its doc says what the code does; `DayCard` testIDs take the block prefix (flow and tests updated); the strip scrolls to the picked day; Today's ring is full strength; the icon-button mock is shared.
Not fixed: 8, `plan-recipe-screen.tsx:68` reads it: `onDateChange={(next, fromStrip) => setPicked({ day: next, fromStrip })}`. 10 rejected. 4: the slot tab is now in view, only the "+" id changed.
