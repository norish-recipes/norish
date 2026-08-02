# 03 — Step Ingredients foundation: storage and amounts under steps

**What to build:** A recipe can carry Step Ingredients — references from a step to the ingredient lines it uses, each a fractional share — and the recipe page shows the resolved names and amounts beneath each step, in both page layouts and both measurement systems. Data enters through the save path and repositories in this slice; the editor UI follows in 04. Verified through tests rather than a UI walkthrough.

**Blocked by:** None — can start immediately.

**Spec:** `.scratch/general-improvements/spec.md`

**Status:** ready-for-agent

- [ ] Step Ingredients are stored per measurement system with a fractional share (default one) and a display order, and are deleted with their step or their ingredient line.
- [ ] References travel with the step payload on save — the same mechanism step images use — so they survive the editor's recreate-on-save behavior.
- [ ] The full recipe contract exposes each step's Step Ingredients.
- [ ] Amounts render beneath steps on the recipe page in both the desktop and mobile layouts, derived at display time as share × the line's current amount; a line with no amount shows its name only.
- [ ] Editing an ingredient line's amount changes what renders under its steps without any reference being touched.
- [ ] Real-database repository tests cover save round-trip and cascades; shared-library tests cover amount derivation, including fractions and per-system resolution.
