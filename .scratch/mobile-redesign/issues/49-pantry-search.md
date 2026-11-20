# 49: Pantry search and suggestions

**What to build:** Make the Pantry's search find foods the way recipe search does, and give Add to pantry web's suggestions. Reported by Mike on the device, 2026-11-17.

**Blocked by:** none

**Status:** done

- [x] Reproduce first: the Pantry field (`pantry-screen.tsx`, `usePantryScreen`) and the Add to pantry sheet (`pantry-add-screen.tsx`, `usePantryCatalogue`) on Mike's report that search "doesn't work". A failing test captures what breaks.
- [x] Search matches partial hits (part of a word, any word of the name), as recipe search does; reuse the shared matcher recipe search uses rather than a new one.
- [x] Add to pantry, with the field empty, lists the foods the household's recipes use often that the Pantry doesn't cover, as web does ("From your recipes", `usePantrySuggestions` in `@norish/shared-react/groceries`); tapping one keeps it.
- [x] Unit tests for the matching and the suggestions; gates green; checked on the device.

## Comments

- Reproduced on the iOS 27.2 simulator (Release): the Pantry field filtered single words but "bell oil" and any multi-word text found nothing; the Add to pantry sheet listed the first 8 contains-hits alphabetically, so "ho" showed "acacia honey, added sugar, aioli, albacore, alcohol..." and "gar" buried "garlic" foods: the server ordered exact name, then name, with no word-start rank. Typing and the keyboard worked in both fields.
- Fixes: the catalogue ranks a name with a word starting with the text before one that only contains it (db test, red then green); `searchPantry` matches any word typed, as recipe search ORs its terms (recipe search is server tsquery, there is no client matcher to reuse, so `nameWords` is the shared piece); the sheet shows "From your recipes" with the field empty, via the existing `uncoveredSuggestions`, with web's keys. The suggestion logic was already in shared, so no web move was needed.
- Decided: all offered suggestions show (no Show more, no per-row recipe count) in the sheet. The multi-word typed text still searches the catalogue as one phrase in the sheet.
- Device: both fields, light and dark, checked after the fix; egg kept from the suggestions and removed again. The pantry Maestro flows pass on first run; none asserts the suggestions.
- Review round 1 (Standards + Spec), dispositions:
  1. fix: the Add sheet still searches several words as one phrase (`parseIngredientSearch` builds one pattern), so "olive ex" finds nothing; the commit only reordered results.
  2. fix: `searchPantry` now matches when ANY typed word matches, so "salt a" lists nearly everything, on web's Pantry field too. Both fields take one rule: every typed word matches part of the name, in any order. (My call: recipe search ORs its words because it ranks; a filter narrows.)
  3. fix: the ranking reads `lower(name)` while the where matches folded text and translations, so "creme" never ranks "Crème fraîche", "skimmed" is no word start in "Semi-skimmed milk", and a food found through another language never ranks. It ranks on the text the where matched.
  4. fix: "From your recipes" on the sheet shows up to 36 at once with no recipe count; web shows 6, a Show more and the count per food.
  5. fix: before the Pantry is read the sheet shows unfiltered suggestions and a tap keeps one; nothing shows until it is read.
  6. fix: the empty-field rule, fallback and header flag move from the screen into `pantry-add-rows.ts` with tests; a repository test for several words; a screen test for suggestions only while the field is empty and a tap keeping the food.
  7. fix: `exactFirst` holds two ranks and its doc comment names one; the escaped fold and the `like` are built twice beside `matchingSearch`.
  8. fix (verify): `pantry-add-screen.tsx` and `use-pantry-screen.ts` both fetch the suggestions and call `uncoveredSuggestions` with the same inputs.
  9. fix (verify): a Maestro assertion for the suggestions in `pantry-add-from-sheet`, if the seed has recipes that give any.
  10. docs: the ranking and the every-word rule change web's released ingredient and Pantry search, so the Target Version's release notes get a line (Terra).
  11. reject: the ranking reordering web's ingredient pickers and admin search as scope creep; word starts first is the better order everywhere and no web E2E asserts the order.
  12. reject: reusing recipe search's matcher; it is server full-text search, there is no client matcher to reuse.
- Round 1 fixes: both fields take one rule, every typed word is somewhere in one name (or one translation), any order, on folded text. The catalogue folds the name in SQL as `foldName` does and ranks on the same texts: the exact fold, then a word starting with the first word typed, then flagged, `lower(name), id`. `usePantrySuggestions(items)` returns what the Pantry lacks (web, Pantry and the sheet share it); `shownSuggestions` holds the Show more rule.
- The sheet shows six suggestions with "in N recipes" and Show more, nothing until the Pantry is read, matches once anything is typed (`pantryAddList`, unit and screen tests). Maestro `pantry-add-from-sheet` now keeps the seeded recipe's egg from the suggestions.
- Device (iOS 27.2 Release, mike, light and dark): Pantry "oil olive" → olive oil; "olive ex" → none kept; "salt a" → salt; "pepper b" → bell + black pepper; "ol" → 6 foods alphabetical. Sheet "olive ex" → 5 extra virgin olive oils; "oil olive" → 8 olive oils; "creme" → cream first (an exact translation), then cream foods; "skimmed" → semi-skimmed milks; "tom" → prawn first (exact translation "tôm"), then tomatoes. Empty field: water 85, egg 77, red onion 63, scallions, ginger, cucumber, Show more; water kept, left the list, removed again.
- Review round 2 (the fix range), dispositions:
  1. fix: the ranking ignores the user's language: "tom" puts prawn first (Vietnamese "tôm" is an exact translation match) ahead of every tomato. Both ranks read the name plus the aliases of the user's languages (`catalogueLanguagesFor(query.locale)`, already known one layer up); the where stays on every text.
  2. fix (bug): the SQL fold is not `foldName`: no NFC step, so a Korean name stays split into jamo and can never match; dakuten, Arabic and Hebrew marks become spaces; under `LC_CTYPE=C` every non-ASCII letter does. A name that matched before the ticket must still match: the where keeps the old phrase match beside the every-word rule.
  3. fix: both ranks re-run the searched-text expression, alias subquery included, for every matched row; the matched text is computed once.
  4. fix: Show more on the Add sheet stays expanded after typing and clearing the field.
- Round 2 fixes: the where is "every typed word in the folded name, a translation (any language) or the parent's, OR the pre-ticket `lower(name) like '%<fold>%'`". The SQL fold now matches `foldName`: NFD, the `\p{Diacritic}` ranges stripped, NFC, lowercase; an ASCII name skips straight to the last step, and for a contains test is only lowercased.
- The ranking is one `least(...)`: 0 exact fold, 1 a word starting with the first typed word, 2 the rest, over the folded name (one lateral fold per matched row) and the translations in `catalogueLanguagesFor(locale)` or none (two uncorrelated `in` sets, hashed once). Then flagged, `lower(name)`, id. English "tom": tomatoes before prawn; Vietnamese "tom": prawn first.
- Dev DB EXPLAIN ANALYZE (6,290 foods, 72k spellings), start → now: "t" 14.8 → 20.6 ms, "olive oil" 11.1 → 23.4 ms (with JIT off: 4.9 → 10.2 ms). What's left is the fold over non-ASCII names and the reader's-language rank.
- Release notes: `e36e4f5dc`, `df0b4717b` (0.27.0-beta, Fixes and Improvements). Exit gate on `df0b4717b`: all seven gates exit 0.
- Accepted: the catalogue search costs more than before the ticket (`EXPLAIN ANALYZE` on the dev database: "t" 14.8 → 20.6 ms, "olive oil" 11.1 → 23.4 ms); what is left is the fold of non-ASCII names and the rank by the reader's languages.
