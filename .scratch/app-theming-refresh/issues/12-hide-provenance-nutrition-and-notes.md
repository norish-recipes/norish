# 12 — Hide Recipe Provenance, Nutrition Information and notes

**What to build:** A cook who never reads where a dish comes from, never checks its nutrition, and never writes notes can turn all three off and reach the steps sooner. These three sections join the Hidden Item list that ticket 04 built, and hiding one closes the page up properly — no gap, no divider, no empty heading left behind.

Hiding Recipe Provenance keeps the origin flag beside the recipe's title. The glossary classes that flag as chrome rather than as Recipe Provenance, so it surviving is a consequence of what the terms mean, not a special case.

Nutrition Information is hidden as one thing. The glossary defines it as calories, fat, carbohydrates and protein together and warns against "Macros" precisely because that word excludes calories — so the group never renders partially, and the word does not appear in the settings copy or the translation keys.

**Blocked by:** 04 (Hidden Items replaces the display preferences).

**Status:** ready-for-agent

- [ ] Hiding Recipe Provenance removes its card from the recipe page on both the desktop and mobile layouts.
- [ ] The origin flag beside the recipe title stays when Recipe Provenance is hidden.
- [ ] Hiding Nutrition Information removes the whole four-value card — calories, fat, carbohydrates and protein together, never one tile of four.
- [ ] Hiding notes removes the notes card.
- [ ] A hidden section leaves no gap, divider or empty heading behind, and the rules drawn between the remaining sections stay correct.
- [ ] Recipe Provenance and Nutrition Information already have visibility predicates that both their own cards and the page layouts consult; the reader's choice is added inside those, so the section rules stay correct without being restated. Notes gains an equivalent predicate rather than being special-cased inline in each layout.
- [ ] Hiding settles nothing about the recipe: the editor still lets a reader set or correct provenance and nutrition, and Recipe Enrichment keeps running and storing for hidden kinds, so unhiding later reveals values that are already there.
- [ ] A shared recipe link shows everything — the person opening it is not signed in and has no preferences.
- [ ] The native app is untouched and still shows nutrition. Its recipe screen has no provenance or notes sections.
- [ ] The page-level suite from ticket 04 grows to cover all six entries, including the flag surviving a hidden provenance.
