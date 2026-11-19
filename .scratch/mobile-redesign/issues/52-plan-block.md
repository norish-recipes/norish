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
