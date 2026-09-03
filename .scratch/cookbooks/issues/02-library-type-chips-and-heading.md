# 02 — The three chips and the dynamic heading

**What to build:** The dashboard stops being "All recipes" and becomes the **Library**. Three chips sit permanently under the search bar — All, Recipes, Cookbooks — and the heading names whichever is active: _Your library_, _Your recipes_, _Your cookbooks_, changing with a short animation. The choice is remembered on this device. No cookbooks exist yet, so the Cookbooks chip shows an empty state; All and Recipes both show the recipe Library as they do today.

This slice carries the riskiest interface work in the feature and de-risks it before any cookbook exists.

**Blocked by:** 01 — the chips take the row the search-field toggles occupy.

**Status:** ready-for-agent

- [ ] Three chips render permanently under the search bar, not on focus, with All selected by default
- [ ] The heading animates between three complete translated strings with a short fade, slide and width change
- [ ] A reader who prefers reduced motion gets an instant swap rather than an animation
- [ ] The active chip persists per device alongside the other filters
- [ ] The chip is excluded from the applied-filters predicate and from the funnel's active dot, and Clear filters leaves it alone
- [ ] The type filter is a parameter of the Library query, not a slice applied to an already-fetched page
- [ ] An absent or unrecognised persisted value normalises to All rather than corrupting the stored filters — this is what keeps the mobile app, which shares the contract and will not render the chip, working
- [ ] The Cookbooks chip shows an empty state explaining that cookbooks do not exist yet
- [ ] The "All recipes" string is retired and the three heading strings exist in all 14 locales; `pnpm i18n:check` passes
- [ ] The shared filter contract test covers the default, the query serialisation, the persistence round-trip, the absent-value case and the applied-filters exclusion
