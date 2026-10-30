# 43: A spelling that holds another spelling of its food goes

**What to build:** Found by the audit of ticket 31's final run (2026-10-22, `m31c_post_on`). 167 own spellings (175 lines) are whole line texts that carry a note or an amount: "garlic powder to taste for the coating", "null zout", "snuf komijn", "klontje boter", "boneless chicken breast". 126 sit on seeded foods and 41 on own ones. Every one names the right food, but each shows up as a translation.

**Why the first start keeps them.** Steps 2–3 of `cleanUpCatalogue` (`seed/first-start-cleanup.ts`) treat a spelling as a variant only where `cleanSpellingOf` reduces it. That function uses the plain name from `spellingKeys`, which strips:

- a number at the start;
- the units map's phrases at either end;
- a weight, volume or container at the start;
- preparation and size words at either end.

None of that covers these spellings:

- a note in the middle: in "to taste for the coating", "to taste" is not at the end;
- "null", the amount a broken export wrote;
- amount words the units map lacks ("snuf", "klontje", "kilo", "halve", "paar");
- typos ("tbso", "etlp");
- notes ("evt", "Extra", "lekker met").

So `cleanSpellingOf` hands back the spelling unchanged, and it stays.

**Nothing in the import's line parser to reuse.** `parseIngredientWithDefaults` (`packages/shared/src/lib/helpers.ts`, parse-ingredient) takes an amount and a unit off the line's ends and moves an amount found mid-line to the front. A note stays in the name. The only note cut is `endsBefore` in `parentFromWords`, and that reads a parent, not a spelling. Using it at rung 2 would also read "beans in tomato sauce" as beans.

**Fix (one cleanup step, no word list):** an own spelling whose fold holds another spelling of the same food, in whole words, is removed with the existing `deleteCatalogueAlias`. Its rows move to the food's name spelling, else the oldest, so no row changes food. A food's name spelling and seeded spellings are never removed. `CLEANUP_VERSION` goes to 4.

- **Measured on the copy:** it removes 151 of the 167. It also removes 288 variants the audit judged fine ("fresh parsley", "warm milk", "minced garlic"): 439 in all, and no line changes food.
- **Left:** 16. These are plurals ("ground cloves" on ground clove) and spellings that hold no other spelling of their food. "boneless" and "lbs boneless" on chicken breast are what the comma cut left of "boneless, skinless chicken breasts".
- **Cost:** a later recipe that writes one of these texts again misses rung 1 and mints. AI then merges it back once, as an AI Change, and the spelling returns to the food.

**Blocked by:** None

**Status:** wontfix

- [ ] After the first start, "garlic powder to taste for the coating" and "null zout" are no spellings, and their lines still name garlic powder and salt.
- [ ] A food's name spelling and seeded spellings ("paprika (vrucht)") are kept.

## Closed (2026-10-22, Mike: wontfix)

These spellings are not wrong. "snuf komijn" on cumin and "fresh parsley" on parsley let the next identical line find its food at rung 1, with no AI and no word list.

- The import's parser (`parseIngredientWithDefaults`, parse-ingredient) only takes a number and a known unit off, so running it again cleans about 2 of the 167.
- Removing them makes duplicates later (AI off: each new line mints) or AI requests (AI on: the pass merges each back).
- The spellings that are wrong are the ones that do not name their food at all, such as "boneless" and "lbs boneless" on chicken breast. Those go to ticket 46.
