# 22 — Fill a cookbook from its own side

**What to build:** A third quick action on a cookbook, beside Edit and Delete: **Add recipes** opens every recipe with a search box and adds everything ticked, in one go. Supersedes `spec.md`'s "Mass select and bulk add — explicitly deferred to its own feature", scoped to one cookbook rather than to the Library.

**Status:** ready-for-human

- [x] Reachable from the cookbook's card in the Library and from the menu on its own page, so it sits wherever the other two actions do
- [x] The same ticked rows and the same Save as every other cookbook panel; nothing is written until Save
- [x] The button says how many it will add, so a long list does not need counting back
- [x] Recipes already in the cookbook are not filtered out and cost nothing to tick: filing is idempotent by the unique pair (ADR-0027)
- [x] Adding is the existing per-recipe mutation, once per tick, so permissions, the Outbox and the echoes are the ones already proven rather than a second path with its own rules
- [x] Taking recipes out stays in the edit panel — a list titled "Add recipes" whose ticks also removed would be two controls wearing one coat
- [x] Browser E2E: a cookbook fills itself from its own side, staged until Save
