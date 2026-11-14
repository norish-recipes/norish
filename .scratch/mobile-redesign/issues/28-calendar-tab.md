# 28: Calendar tab

**What to build:** The Calendar tab. See `.scratch/mobile-redesign/spec.md` Part 5 ("Calendar tab", "Drag") and the Calendar boards plus ticket 18's empty and offline.

**Blocked by:** 19, 27

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: the drop rule of `use-calendar-dnd.ts`.
- [ ] The timeline of day cards, two weeks either side, growing at the edges, opened on today with a way back, Today ringed; empty and offline states.
- [ ] A tap opens the planned-item sheet (date, slot, go to recipe, add to groceries, remove); a day's add opens add-to-day; "Plan recipe" accessory with a day picker.
- [ ] Hold and drag to another day: keeps its slot, lands last, no growth while dragging; through the Outbox.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
