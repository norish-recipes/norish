# 82: Variants of an own food stand alone

**What to build:** Found by the same AI-off import as tickets 80 and 81 (2026-10-26). The parent from words looked only at seeded spellings, so the variants of a food the seed lacks never grouped: "krieltjes in de schil", "krieltjes in schil", "krieltjes met schil", "kilo krieltjes", "verse krieltjes", "roodschillige krieltjes", "barbecue mini-krieltjes" each stood alone, and so did the protein powder, eiwitpoeder, sweetener and oil spray families. Words before a note ("in de schil", "om te bakken") picked the parent but never the food, so "olie om te bakken" became an own food under oil.

On the import: ~40 own foods had a matching own food among the others (simulated).

**Blocked by:** 80, 81

**Status:** done

## Decided (Mike, 2026-10-26)

"explore how we can better match foods that are related... dont get biased towards a language": own foods count as parents, the words before a note find a known food, and a variant minted first is filed once its food is minted. Compound endings ("krielaardappelen" under potato) are left to AI: 7 of 50 went wrong in a simulation.

## Implemented (2026-10-26)

- `findFoodSpellingsByFolds(folds, "seeded" | "listed")` replaces `findSeededFoodSpellingsByFolds`. `parentFromWords(spelling, exceptId)` tries the seeded spellings first, then listed own foods, never the food itself; `readName().parent` and the recheck pass the mint's id.
- `notedParts` (shared `spelling-keys.ts`) splits a key at its note (`noteAt`, the `endsBefore` cut), unless the note word joins foods anywhere (Spanish "en"). A resolver `Spelling` carries the readings of both halves as `noted`, and `matchRead` takes the head where the whole is unknown, the head is known and the rest is not. Rungs in `resolveTexts` and `findIngredientFor` read it; the joined split, `otherFoodsSpelled` (recheck merges) and `findFood` (AI's names) do not.
- Offline, `pantryIngredientFor` reads an unsynced line's head the same way, so the shared `SPELLING_CASES` still agree online and offline ("olie om te bakken" covered by olie). Offline cannot tell whether the words after the note name a food ("kip met rijst"); syncing settles it.
- `writeResolved` hands its mints, once written, to `adoptEarlierVariants`: the undecided parentless listed own foods holding one of the new food's spellings as whole words (`listParentlessMintsSpelledWith`) are filed under it where `parentFromWords` agrees. `announcingAfter` takes that `afterWrite` step, and `announceMinted` now holds mints whether or not anyone listens.
- `RUNG_VERSION` 12: the startup recheck files existing variants under own foods.
- Tests: `parent-from-words.test.ts` (own parent, seeded first, note tests moved to unknown heads), `resolver.test.ts` (note reading and its two guards, a later recipe's mint adopts an earlier variant), `recheck-mints.test.ts` (legacy variants filed, none merged), `spelling-cases.ts` (note cases both ways). `ai-changes.test.ts` and `review.test.ts` mint "red onion" before "onion", since it now goes under an own onion minted first.
- Docs: CONTEXT.md (Alias, Parent Ingredient), ADR-0037 amendment, release notes, the Ingredients page, pt-BR docs.
- Known misses, left to AI: a Dutch "X of Y" line gets its last alternative as parent; "krieltjes" and "baby potatoes" stay apart.
