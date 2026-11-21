# 10: See all matching Ingredients

**What to build:** Mike, 2026-11-20: "There should be a way to see all matching ingredients?" Narrow to offers 3 Ingredients; a reader looking for a fourth has no way to reach it.

**Blocked by:** 09

**Status:** ready-for-agent

**Proposed (Mike has not confirmed the shape):** when more Ingredients match than the 3 shown, a last row under them, "All N ingredients", opens a sheet (the app's half-height glass search sheet) listing every matching Ingredient with its icon, most-used first. Tapping one adds its chip, clears the text and shows Results, as a Narrow-to row does.

- [ ] Server: `library.suggest` says how many Ingredients match; a read lists them all for the text (same matching, visibility and order as the 3), bounded. Repository tests.
- [ ] On Mike's data "Kip" offers garlic first and chicken second. Find why garlic matches (which name or alias) and make the order put a match on the name the reader sees ahead of a match on another language's name or an alias; test with that case.
- [ ] Mobile: the "All N ingredients" row and the sheet, Hidden Items respected, applied Ingredients left out, a skeleton first frame; rules in the plain modules with tests; i18n in every locale.
- [ ] Gates green; a Maestro flow; checked on the simulator, light and dark.

## Comments
