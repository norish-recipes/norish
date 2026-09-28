# The ingredient catalogue is seeded from Open Food Facts under the ODbL

A new instance knew no foods: "ui", "onion" and "Zwiebel" were three Ingredients until a Decision or a person said otherwise, and an instance without AI never learned it. Deduplication should work from the first import, in every language a household cooks in.

**The catalogue is seeded from the Open Food Facts ingredients taxonomy — every entry, every language, additives included — fetched nightly.** Each entry becomes an ownerless Ingredient named for its English name (else its first name) and carrying the entry's id (`en:onion`); each of its names becomes a seeded alias with its language; its first parent becomes the Parent Ingredient. The file is read whole and validated before anything is applied, and applied in one transaction, so a failed fetch or a file that is not a taxonomy (an error page served in its place) leaves the last good seed. The fetch is conditional on the last applied file's validators, runs on the midnight cron and at every boot (cheap once applied), and reports failure through the job monitor like every scheduled task. `INGREDIENT_CATALOGUE_URL` points it at a mirror; empty turns it off, and Norish resolves names without a seed exactly as before.

**A refresh never undoes what a household taught Norish.** It upserts only seeded rows: it adds spellings but never moves one another Ingredient holds (the first claim holds, and the collision is logged); it finds an entry's Ingredient by its id, else by the Ingredient that holds its name, which it adopts; an entry whose name another entry's Ingredient holds was merged there by a person and is left merged; and it places only Ingredients whose parent no person chose (`parent_chosen`). An entry the file drops is removed only when nothing uses it — no reference through any of its spellings, no link, no person's spelling, no child.

**The first applied seed is followed by one pass over the Ingredients that existed before it.** An Ingredient whose spellings (or the same with the preparation stripped) the seed gives to exactly one entry is merged into it — as sure as an exact alias match — and one the seed gives to several is flagged. The pass does not ask the language model: it walks an instance's whole history at once. It runs once, recorded in the seed's state, so a later name a person kept apart stays apart.

**The licence is accepted.** The taxonomy is under the Open Database License, share-alike on the database: the catalogue tables Norish derives from it are offered under the same terms. The Ingredients page credits Open Food Facts and links the ODbL, and offers the whole catalogue — Ingredients, spellings, parents, never owners — as JSON to any signed-in user, which covers both readings of whether an instance's household members are "the public". This reading comes from the licence text and OpenStreetMap's community guidelines, not settled law.

## Considered and rejected

- **CIQUAL, USDA and NEVO.** They are nutrition tables: their value is macros, which are out of scope, and their food lists are narrower and single-language. NEVO's terms forbid redistribution, which an open-source seed would be.
- **Shipping the seed in the image.** It would age with the release and need an upgrade to learn a new food or translation; the nightly fetch keeps it current, and a mirror covers an offline server.
- **Asking the language model in the one pass.** One request per existing Ingredient at boot is a cost an administrator did not choose; the resolver's rung 3 still asks about every new name.

## Consequences

- `ingredients` carries `off_id` (unique) and `parent_chosen`; seeded aliases carry `seeded` and a locale. Migration 0062.
- About 5,700 entries and 69,000 spellings; applying the file takes seconds and a re-apply of an unchanged file changes nothing.
- A seeded Ingredient is an administrator's to edit (ADR-0037's edit policy); an adopted one keeps its owner.
