# 04 — Step editor chips: attach, share, remove

**What to build:** Beneath each step in the editor sits a chips row: a picker attaches any of the recipe's ingredient lines to the step without naming it in the text (how "add the spices" carries its three links), each chip's fractional share is editable — half, a third, a quarter, or a custom value — and a chip is removed with a tap. Demo: attach "water" at one-half to a step, save, and read "25 ml water" beneath that step on the recipe page.

**Blocked by:** 03 — Step Ingredients foundation.

**Spec:** `.scratch/general-improvements/spec.md`

**Status:** done

- [x] Every step in the editor has a chips row with an add picker over the recipe's ingredient lines.
- [x] A chip's share defaults to the full line and can be set to ½, ⅓, ¼, or a custom fraction; a chip can be removed.
- [x] Chips round-trip through save and render as amounts beneath the step on the recipe page.
- [x] Heading rows cannot receive chips.
- [x] Unsaved-changes detection treats chip edits as edits.
- [x] Component tests live beside the existing recipe-form tests.

## Comments

- Shipped in 9908249a. Chips row beneath every non-heading step with an add picker over the recipe's lines; shares editable (whole, ½, ⅓, ¼, custom) and chips removable with a tap; heading rows can't receive chips and shed any they had; chip edits count as unsaved changes; round-trips through save. Component tests beside the recipe-form tests.
