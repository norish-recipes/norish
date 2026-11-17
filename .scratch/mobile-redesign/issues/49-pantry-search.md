# 49: Pantry search and suggestions

**What to build:** Make the Pantry's search find foods the way recipe search does, and give Add to pantry web's suggestions. Reported by Mike on the device, 2026-11-17.

**Blocked by:** none

**Status:** ready

- [x] Reproduce first: the Pantry field (`pantry-screen.tsx`, `usePantryScreen`) and the Add to pantry sheet (`pantry-add-screen.tsx`, `usePantryCatalogue`) on Mike's report that search "doesn't work". A failing test captures what breaks.
- [x] Search matches partial hits (part of a word, any word of the name), as recipe search does; reuse the shared matcher recipe search uses rather than a new one.
- [x] Add to pantry, with the field empty, lists the foods the household's recipes use often that the Pantry doesn't cover, as web does ("From your recipes", `usePantrySuggestions` in `@norish/shared-react/groceries`); tapping one keeps it.
- [x] Unit tests for the matching and the suggestions; gates green; checked on the device.

## Comments

- Reproduced on the iOS 27.2 simulator (Release): the Pantry field filtered single words but "bell oil" and any multi-word text found nothing; the Add to pantry sheet listed the first 8 contains-hits alphabetically, so "ho" showed "acacia honey, added sugar, aioli, albacore, alcohol..." and "gar" buried "garlic" foods: the server ordered exact name, then name, with no word-start rank. Typing and the keyboard worked in both fields.
- Fixes: the catalogue ranks a name with a word starting with the text before one that only contains it (db test, red then green); `searchPantry` matches any word typed, as recipe search ORs its terms (recipe search is server tsquery, there is no client matcher to reuse, so `nameWords` is the shared piece); the sheet shows "From your recipes" with the field empty, via the existing `uncoveredSuggestions`, with web's keys. The suggestion logic was already in shared, so no web move was needed.
- Decided: all offered suggestions show (no Show more, no per-row recipe count) in the sheet. The multi-word typed text still searches the catalogue as one phrase in the sheet.
- Device: both fields, light and dark, checked after the fix; egg kept from the suggestions and removed again. The pantry Maestro flows pass on first run; none asserts the suggestions.
