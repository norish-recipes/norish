# 83: A whole-catalogue run reshapes the seed and renames too little

**What to build:** Found in a whole-catalogue Clean up of Mike's import (2026-10-26, after ticket 82). Of the first 647 seeded foods asked about, 115 were merged and 321 got a parent from AI, some wrongly: "cumin" into "cumin seeds", "pepper" into black pepper, "casing" into sausage skin. Every recipe line on cumin then pointed at cumin seeds. The spelling check of the spellings added to seeded foods, the useful part, ran on 7. Among own foods the run kept unrenamed, about 30 Title Case names stayed ("Dressing", "Oyster Sauce", "Burger Buns") because a case-only difference settled the name (ticket 67), and container notes stayed because the prompt's own example keeps "tonijn uit blik" ("witte bonen in blik", "tonijnstukken in water").

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-26)

"it should exclude the seeded foods". Lower Title Case names to AI's casing, and take container and serving notes off a Plain Name. Not taken: renaming foods AI was unsure were several foods.

## Implemented (2026-10-26)

- `cleanUpOverWholeCatalogue` asks AI nothing about a seeded food and returns `skipped: seeded` with its spellings' check. `listWholeCatalogueCleanUpIds` (the run's food list and the dialog's count) holds listed own foods and the seeded foods with an added spelling; Fill gaps keeps `listListedIngredientIds`.
- `giveItsPlainName`: a plain name differing from the name only in case renames it; one differing in accents or marks still settles the name as it is.
- `ingredient-plain-name.txt`: takes off what a food comes in or is served with ("uit blik", "in water", "naar keuze", "for the coating"); "GR TONIJN UIT BLIK" is "tonijn"; capitals a language always writes stay ("Italian sausage").
- Tests: `review.test.ts` (whole-catalogue list; a seeded food gets no question), `plain-names.test.ts` (case-only renames, accents settle), queue `producer.test.ts`.
- Docs: CONTEXT.md (Plain Name, Catalogue Cleanup), ADR-0037 amendment, release notes (Clean up catalogue line, prompt upgrade note), AI provider and Ingredients pages, pt-BR docs.
