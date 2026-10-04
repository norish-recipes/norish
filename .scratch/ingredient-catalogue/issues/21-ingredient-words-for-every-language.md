# 21: Ingredient words for every language

**What to build:** On the production copy, Mike found "bosuien" and "bosuitjes" left as separate foods beside spring onion, "ongeveer 4 el fijngesneden bosuien" left as a name of its own, and ")" and "[object Object]" as flagged foods. He also asked whether the fixes so far only worked for Dutch: "it needs to be generic". They didn't. Rung 2's preparation words and the parent from words' lists were fixed English and Dutch word lists in code.

The words a name is read by become data per language beside the units map, shipped for every language Norish speaks and editable by an administrator under Content Detection. The mechanisms stay generic.

**Blocked by:** 20

**Status:** done, pending review

- [x] `packages/config/src/ingredient-words.default.json` holds the words of all 14 languages the units map covers:
  - preparation, joiners, connectors;
  - what a food comes in or with;
  - words that never name a food;
  - approximations and sizes;
  - plural and diminutive endings.
- [x] Server config `ingredient_words` stores `{ words, isOverridden }`:
  - it is seeded and kept in step with the file until an admin saves their own, compared with keys sorted because jsonb keeps no key order;
  - Restore defaults puts the shipped words back.
- [x] `spellingRules(units, words)` replaces `unitPhrases`. Every word list in `spelling-keys` and the resolver comes from it, folded, with every language applied to every name.
- [x] Rung 2 reads a plural or diminutive of a known spelling as its food, both ways ("bosuien" and "bosuitjes" are "bosui"). It also strips sizes at either end, and a quantity an import left at the start ("ongeveer 4 el", "4el", "400g").
- [x] A line with no letter or digit, or "[object Object]", names no food: kept as written, with no alias.
- [x] The browser reads the same rules (`useSpellingRules`): pantry matching, a grocery's Ingredient, the worked-out nutrition's sizes and approximations.
- [x] Settings → Admin → Content Detection → **Ingredient words**, a JSON editor like Units, labelled in all 15 locales.
  - Saving or restoring refreshes the browser's copy.
  - Units now does too; before, it was left stale for an hour.
- [x] `RUNG_VERSION` 3, so the boot recheck reads old flagged mints under the new rules.
- [x] Docs (admin settings, ingredients), release notes, glossary and ADR-0037.
- [x] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, Mike: "go ahead with 1-4 and make it so the matching can be set in the admin ui as well". 1-4 were: language data instead of code lists, plurals that match rather than file, quantities left at a name's start, and junk names.
- Deliberate choices:
  - Words that also name a food are left out in every language, as "minced" already was: "haché", "picado", "gehakt", "rubleny", "다진" (steak haché is a food).
  - Portuguese "mais" ("more") is left out of the words that never name a food, because in Dutch it is corn.
  - Every language's words apply to every name: a recipe's language is not recorded. An ending from one language can make a candidate in another, but a candidate only ever matches a spelling Norish already knows, and exact spellings match first.
  - A plural stays the food itself. "peppers" alone therefore reads as Open Food Facts' peppercorn, as "pepper" already does. Adding "peppers" as a spelling of bell pepper fixes it once.
  - The rung-3 and review tests had used plurals ("onions") as names rung 2 can't read. They now use "onion bulbs", which shares a word with the candidate, so AI is still offered onion.
- 2026-10-02, measured. The production copy was upgraded again from pristine on this build, as Mike's :3400 instance:
  - "bosuien", "bosuitjes", "bosuitjes, in kleine ringen" and "ongeveer 4 el fijngesneden bosui" all read as spring onion, unflagged.
  - ")" and the 17 "[object Object]" lines keep no food, and no Ingredient is named like either.
  - Still flagged: "strengen bosui", under spring onion, and "0 cal sweetener of choice", which Mike expected.
  - The totals went from 7,260 to 7,088 Ingredients, 1,559 to 1,387 flagged, and 404 to 372 unseeded with no parent.
  - The backfill takes 9 s and the recheck under 1 s, down from 43 s and 50 s before the rules were cached per pass.
- 2026-10-04, Mike on the production copy: "i still see products with just el or GR runderhakt … we should always filter out the UOMS".
  - Rung 2 strips a weight or a volume at a name's start without a number before it. `MEASURE_MAP_IDS` (`@norish/shared/lib/units`) says which units-map entries those are, and it is the unit table nutrition's `leadingUnitOf` reads too. Pieces stay ("glass noodles").
  - `namesNoFood` also covers an amount alone ("el", "1 el", "200g"), by `isMeasure(resolveUnit(word))`.
  - `RUNG_VERSION` 5.
  - Measured on the copy's 3,228 line names: all 57 that started with a weight or a volume were left-over units. 56 now read as their food, and the bare "el" names no food. In the 69,415 seeded spellings only "gram flour", "gram-meel", "grammo nero" and "cup mushroom" start with one; they still match exactly.
  - The amount-alone rule makes 1 line name no food on the copy ("el", in "Gehaktballen"), and 1 seeded spelling: a Dutch "c" alias of golden chanterelle.
