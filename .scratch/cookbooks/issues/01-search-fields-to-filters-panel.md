# 01 — Move the search-field toggles into the Filters panel

**What to build:** A reader can still choose which fields a search looks in — Title, Description, Ingredients, Steps, Tags — but chooses them in the Filters panel alongside tags, categories, sort and rating instead of on a row under the search bar. Nothing about searching changes; only where the control lives. This is a prefactor: it frees the row the Library's type chips will occupy, and it ships on its own.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The five search fields appear as a group in the Filters panel and apply with that panel's existing Apply button
- [ ] The toggles no longer render under the search bar, and the two-second blur timer that revealed and hid them is removed with them
- [ ] Search results are identical to today for the same selected fields
- [ ] Search-field preferences persisted before this change continue to work untouched
- [ ] The shared filter contract's search-field type and defaults are unchanged
- [ ] The group's label exists in all 14 locales and `pnpm i18n:check` passes
- [ ] The existing filter contract test stays green
