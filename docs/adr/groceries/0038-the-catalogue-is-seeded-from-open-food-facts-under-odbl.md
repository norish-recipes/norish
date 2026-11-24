# The ingredient catalogue is seeded from Open Food Facts under the ODbL

Without a seed, an instance knows no foods: "ui", "onion" and "Zwiebel" are three Ingredients until AI or a person says otherwise, and an instance without AI never learns it. Deduplication should work from the first import, in every language a household cooks in.

**The catalogue is seeded from the Open Food Facts ingredients taxonomy — every entry, every language, additives included — fetched nightly.** Each entry becomes an ownerless Ingredient named for its English name (else its first name), carrying the entry's id (`en:onion`) and its nutrition codes, piece weight and density, which Ingredient Nutrition reads (ADR-0039); each of its names becomes a seeded alias with its language; its first parent becomes the Parent Ingredient. The seed is every household's, and the administrator's to edit (ADR-0042). The file is read whole and validated before anything is applied, and applied in one transaction, so a failed fetch or a file that is not a taxonomy (an error page served in its place) leaves the last good seed. The fetch is conditional on the last applied file's validators, runs on the midnight cron and at every boot (cheap once applied), and reports failure through the job monitor like every scheduled task. `INGREDIENT_CATALOGUE_URL` points it at a mirror; empty turns it off, and Norish resolves names without a seed.

**A refresh never undoes what a household taught Norish.** It upserts only seeded rows: it adds spellings but never moves one another Ingredient holds (the first claim holds, and the collision is logged); it finds an entry's Ingredient by its id, else by the seeded Ingredient that holds its name, and never takes over or changes a household's own food; an entry whose name another entry's Ingredient holds was merged there by a person and is left merged; and it places only Ingredients whose parent no person chose (`parent_chosen`). An entry the file drops is removed only when nothing uses it — no reference through any of its spellings, no link, no person's spelling, no child.

**The first applied seed comes before the upgrade's resolution of existing data**, at the first boot, so an instance's history is read against the catalogue rather than the catalogue against its history. An adopted Ingredient takes the entry's name and loses its flag: the seed vouches for it.

**The first applied seed is followed by one pass over the Ingredients that existed before it**, which an upgrade leaves only where its first boot had no seed, and by a look at the undecided mints again. An Ingredient whose spellings (or the same with the preparation stripped) the seed gives to exactly one entry is merged into it — as sure as an exact alias match — and one the seed gives to several is flagged. The pass does not ask the language model: it walks an instance's whole history at once. It runs once, recorded in the seed's state, so a later name a person kept apart stays apart.

**The licence is accepted.** The taxonomy is under the Open Database License, share-alike on the database: the catalogue tables Norish derives from it are offered under the same terms. The Ingredients page credits Open Food Facts and links the ODbL, and offers the catalogue a reader can use — the seed plus their household's own Ingredients, spellings and parents, never owners — as JSON to any signed-in user, which covers both readings of whether an instance's household members are "the public". This reading comes from the licence text and OpenStreetMap's community guidelines, not settled law.

## Considered and rejected

- **CIQUAL, USDA and NEVO as the catalogue.** Their food lists are narrower and single-language. CIQUAL and USDA supply Ingredient Nutrition beside the seed instead, joined through the taxonomy's codes (ADR-0039). NEVO stays out: its conditions forbid amendment and charging end users, which the ODbL grants.
- **Shipping the seed in the image.** It would age with the release and need an upgrade to learn a new food or translation; the nightly fetch keeps it current, and a mirror covers an offline server.
- **Asking the language model in the one pass.** One request per existing Ingredient at boot is a cost an administrator did not choose; an administrator who wants AI over the catalogue starts a Catalogue Cleanup (ADR-0037).

## Consequences

- `ingredients` carries `off_id` (unique) and `parent_chosen`; seeded aliases carry `seeded` and a locale. Migration 0062.
- About 5,700 entries and 69,000 spellings; applying the file takes seconds and a re-apply of an unchanged file changes nothing.
- A seeded Ingredient and its seeded spellings are the administrator's to edit; a spelling a household adds to one is that household's.
