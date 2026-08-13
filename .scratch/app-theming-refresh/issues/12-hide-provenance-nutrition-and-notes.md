# 12 — Hide Recipe Provenance, Nutrition Information and notes

**What to build:** A cook who never reads where a dish comes from, never checks its nutrition, and never writes notes can turn all three off and reach the steps sooner. These three sections join the Hidden Item list that ticket 04 built, and hiding one closes the page up properly — no gap, no divider, no empty heading left behind.

Hiding Recipe Provenance keeps the origin flag beside the recipe's title. The glossary classes that flag as chrome rather than as Recipe Provenance, so it surviving is a consequence of what the terms mean, not a special case.

Nutrition Information is hidden as one thing. The glossary defines it as calories, fat, carbohydrates and protein together and warns against "Macros" precisely because that word excludes calories — so the group never renders partially, and the word does not appear in the settings copy or the translation keys.

**Blocked by:** 04 (Hidden Items replaces the display preferences).

**Status:** done

- [x] Hiding Recipe Provenance removes its card from the recipe page on both the desktop and mobile layouts.
- [x] The origin flag beside the recipe title stays when Recipe Provenance is hidden.
- [x] Hiding Nutrition Information removes the whole four-value card — calories, fat, carbohydrates and protein together, never one tile of four.
- [x] Hiding notes removes the notes card.
- [x] A hidden section leaves no gap, divider or empty heading behind, and the rules drawn between the remaining sections stay correct.
- [x] Recipe Provenance and Nutrition Information already have visibility predicates that both their own cards and the page layouts consult; the reader's choice is added inside those, so the section rules stay correct without being restated. Notes gains an equivalent predicate rather than being special-cased inline in each layout.
- [x] Hiding settles nothing about the recipe: the editor still lets a reader set or correct provenance and nutrition, and Recipe Enrichment keeps running and storing for hidden kinds, so unhiding later reveals values that are already there.
- [x] A shared recipe link shows everything — the person opening it is not signed in and has no preferences.
- [x] The native app is untouched and still shows nutrition. Its recipe screen has no provenance or notes sections.
- [x] The page-level suite from ticket 04 grows to cover all six entries, including the flag surviving a hidden provenance.

## Comments

- Shipped. `useHiddenItemVisibility` grew `showProvenance`/`showNutrition`/`showNotes`; the provenance and nutrition predicates consult the reader's choice ahead of their stored-or-busy answer, so a hidden section stays absent even mid-run while enrichment keeps storing. Notes moved out of both layouts into `notes-card.tsx` with `useNotesSectionVisible` plus `NotesSection`/`NotesCard`, markup unchanged. The share path renders everything untouched (no signed-in user, and its components never consult the predicates); the origin flag lives in `ReadonlyRecipeSummary`, outside Recipe Provenance, and the page suite renders the real summary to prove it survives. Page-level suite covers all six entries; the provenance and nutrition card suites each gained "absent when hidden, even in flight" as another reason in the same shape.
