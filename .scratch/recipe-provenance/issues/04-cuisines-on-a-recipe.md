# 04 — Cuisines on a recipe

Status: ready-for-agent
Blocked by: 01 — Cuisine vocabulary and admin management; 02 — Provenance pipeline: infer and store country, region, and note; 03 — Provenance on the recipe page

Spec: `.scratch/recipe-provenance/spec.md`
Decision record: `docs/adr/recipes/0012-cuisines-are-curated-tags-are-not.md`

## What to build

Provenance inference now also proposes a recipe's Cuisines, so a cook can recognise a fusion dish that belongs to more than one tradition. Proposed names are resolved against the administrator's vocabulary before anything is stored — under `existing` an unmatched name is dropped, under `extend` it becomes a new row — and the resolved Cuisines are written atomically with the rest of the provenance group and shown on the recipe page.

## Notes

**The cuisine resolver is the high-leverage seam of this feature and the one genuinely new module.** It is a pure function: proposed names, strategy, and current vocabulary in; resolved rows, newly created names, and dropped names out. No database, no AI. Strategy, matching, deduplication and creation all sit behind that one interface, which is why it can be tested exhaustively.

Matching runs under **both** strategies, not just the restrictive one. That is the whole point of the vocabulary: "Sicilian" must land on the row that already means Italian rather than becoming a second row meaning the same thing.

**Cuisine names must be picked verbatim from the supplied vocabulary, in the vocabulary's language, whatever language the note is written in.** The note is written in the recipe's language, and models bleed that instruction across fields — an Italian recipe yields `Italiana`, which under `extend` mints a duplicate row. The prompt has to pin this explicitly.

Dropped names are part of the resolver's return contract and its tests, but **nothing consumes them**. They are not logged, not persisted, not surfaced. A recipe whose cuisine was dropped is indistinguishable from one where nothing fitted. That is a deliberate decision, not an oversight.

The AI request schema is built at runtime from the current vocabulary, never from a compile-time enum.

## Acceptance criteria

- [ ] The cuisine resolver is a pure function taking proposed names, strategy and current vocabulary, returning resolved rows, newly created names and dropped names.
- [ ] Resolver tests run without a database and without AI, covering exact matches, case and whitespace differences, near-miss matching under both strategies, unmatched names under both strategies, duplicate proposals collapsing to one row, and an empty proposal set.
- [ ] Under `existing`, an unmatched proposed name is dropped and no row is created.
- [ ] Under `extend`, an unmatched proposed name becomes a new row, and a near-miss still matches the existing row rather than creating a duplicate.
- [ ] The AI request schema is built at runtime from the current Cuisine vocabulary.
- [ ] Inferrer tests prove cuisine names are taken verbatim from the supplied vocabulary rather than translated into the recipe's language.
- [ ] The repository operation writes the scalar fields, the note, and the Cuisine join rows in one atomic operation; a failed write leaves no partial group.
- [ ] Cuisines appear in the provenance section of the recipe detail page.
- [ ] Substantive Cuisines count as supplied provenance and suppress an automatic run for the whole group.
- [ ] All database access stays in the repository layer; the worker composes no queries.
- [ ] Interface strings are added for every enabled locale and the internationalization gate passes.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Editing Cuisines by hand on a recipe. Ticket 05.
- Migrating existing cuisine Tags. Ticket 06.
- Logging, persisting or surfacing dropped names.
- An approval workflow for AI-proposed Cuisines.
- Re-running inference on recipes inferred before a vocabulary change.
