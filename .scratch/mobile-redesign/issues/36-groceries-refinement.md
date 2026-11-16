# 36: Groceries refinement

**What to build:** The grocery sheets, the Pantry's add sheet and the list's motion. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Groceries").

**Blocked by:** 34

**Status:** open

- [ ] The add and edit sheet keeps its own height when the keyboard opens and rides up on it, with no jump to the full detent.
- [ ] The field's focus ring is not clipped (the sheet body's top padding).
- [ ] On Pantry the accessory reads Add to pantry and opens a sheet that searches existing Ingredients and adds one of them or a custom entry; the Pantry's top field only filters.
- [ ] Motion: a checked item springs into Done; sections and rows animate in, out and on reorder; pickup and drop haptics on drag.
- [ ] Maestro: add a food to the Pantry from the sheet.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
