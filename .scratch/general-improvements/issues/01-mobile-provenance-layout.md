# 01 — Mobile provenance placement & separator ownership

**What to build:** On a phone, Recipe Provenance appears right after the cooking-mode control and before the ingredients — where a dish's origin frames the recipe, as it already does on desktop — and every boundary between sections draws exactly one rule, never two. Desktop is untouched.

**Blocked by:** None — can start immediately.

**Spec:** `.scratch/general-improvements/spec.md`

**Status:** done

- [x] Prefactor commit lands first: the two provenance-card tests that mock modules the shipped component no longer uses are rewritten to test the component as it is.
- [x] Mobile section order is summary → cooking-mode control → provenance → ingredients → notes → steps → nutrition.
- [x] Sections no longer draw their own leading separators; the page owns the rules between sections, and the nutrition section gets the same ownership fix.
- [x] A component test asserts the mobile section order and exactly one separator between adjacent sections.
- [x] Desktop layout and ordering are unchanged.

## Comments

- Shipped. Prefactor test rewrite landed first (adf67748), then the layout fix (f4965ada): provenance sits after the cooking-mode control, sections no longer draw leading separators, the page owns every rule (nutrition included), and recipe-page-mobile.test.tsx pins the order and single-rule invariant. Desktop untouched.
