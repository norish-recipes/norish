# 37: Calendar plan sheets

**What to build:** A drafted planned-item sheet and one move UI. See `.scratch/mobile-redesign/spec.md` Part 6 ("Calendar").

**Blocked by:** 34

**Status:** open

- [ ] The planned-item sheet is a draft: date, slot and note commit on Save; Cancel or swipe down discards (unit test for the draft).
- [ ] Remove asks to confirm, then the item animates out of the timeline.
- [ ] One move UI, the plan sheet's 14-day strip plus its date picker, then the slot tabs, shared by Move from Today and the planned-item sheet; Calendar's Add uses the same strip. The day-cards list stays only for planning a recipe from the recipe.
- [ ] Motion: day cards' items animate in, out and on move.
- [ ] Maestro: edit a planned item's date and slot, Save, see it moved.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
