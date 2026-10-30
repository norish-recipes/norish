# 81: Reading misses kilo, an old import's null, and julienne

**What to build:** Found by the same AI-off import as ticket 80 (2026-10-26). Own foods kept words that name no food:

- Unit words the units map lacks: "kilo krieltjes", "tbs Cajun seasoning", "koffielepel zout", "Snuf zout", "handjevol korianderblaadjes". The map had no kilogram entry at all.
- "null zout", "null sriracha", "null [object Object]": an older import wrote a missing amount as "null" before the name.
- "peen julienne" (6 lines) went under ling, because French spells ling "julienne" and the words-parent read the cut as a food.

On the import: ~20 foods.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-26)

Fix the readings, in every language the lists hold, with no language bias.

## Implemented (2026-10-26)

- `units.default.json`: a `kilogram` entry (short "kg", plurals and alternates for all 16 locales, never "chili", the Italian plural of "chilo"); "tbs" on tablespoon; "koffielepel(s)" and "Kaffeelöffel" on teaspoon; "snuf" on pinch; "flinke snuf", "flink snufje", "flinke snufjes" on generous pinch; "handjevol" on handful. `units.ts` maps kilogram (`mapIds`), so it is a leading measure stripped from a name, like gram.
- `ingredient-words.default.json`: "julienne" in every `forms` list ("juliana" in es/pt; ru "жюльен", uk "жульєн", bg "жулиен", ko "채" want a native speaker's check). `parentFromWords` never takes a one-word cut as a parent window, which "julienne" alone would not have fixed.
- `cleanSpelling` drops a leading "null"; `namesNoFood` reads "null [object Object]" as naming no food.
- `CLEANUP_VERSION` 6 rewrites the spellings this changes on existing data, `RUNG_VERSION` 11 re-reads undecided mints.
- Tests: `spelling-keys.test.ts` (kilo with and without its number, tbs, koffielepels, handjevol, snuf, flinke snuf, null), `ingredient-text.test.ts` (null [object Object]), `parent-from-words.test.ts` (peen julienne under carrot; fails without the window rule), `first-start-cleanup.test.ts` (old "null zout" and "kilo krieltjes" spellings cleaned, lines follow).
- Docs: CONTEXT.md (Ingredient Words, Plain Name), ADR-0037 amendment, release notes (a fixes line and a Units upgrade note), admin settings (`forms`), pt-BR docs.
- An administrator-edited units map or word list gets none of it (upgrade note).
