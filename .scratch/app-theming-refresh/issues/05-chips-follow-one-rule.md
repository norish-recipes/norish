# 05 — Chips follow one rule

**What to build:** Every chip that names something looks the same, so a reader can tell at a glance which chips are labels and which are telling them something. A chip that names a thing carries no meaning in its colour: filled in the accent colour when it is active, soft warm fill when it is not. A chip that reports a condition keeps its semantic colour, because there the colour is the information.

The pattern already exists in the filters panel — selected chips accent-filled, unselected chips soft — and nothing else follows it. This spreads it.

**Blocked by:** 01 (warm theme tokens), 02 (HeroUI 3.2.4).

**Status:** ready-for-agent

- [ ] Chips that name a thing share one treatment: filter categories and Tags, library card Tags, time and servings, Cuisine chips on the Recipe Provenance card, Step Ingredient chips, and the editor's Tag chips.
- [ ] An active chip is filled in the accent colour; an inactive one carries a visible soft warm fill so it reads as a control rather than as loose text on the page.
- [ ] Plain chip text is softened so it reads as a label rather than as body copy at chip size.
- [ ] Chips that report a condition keep their colour: allergy Tags, job status, CalDAV sync and connection status, household roles, API and site token state, the env-managed badge, and the unsaved-changes, restart-required and new-feature chips.
- [ ] The override that gives unselected chips a visible background is retained — it is what stops one disappearing into the page.
- [ ] A cook with allergies can still pick the allergy chip out of a row of Tag chips at a glance.
- [ ] Verified by hand in both themes on a library card, the filters panel, a recipe page and the admin settings pages.
