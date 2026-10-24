# 42: A parent is found only by a spelling in a language Norish reads

**What to build:** Found by the audit of ticket 31's final run (2026-10-22, `m31c_post_on`). Some own foods are filed under a seeded food through a spelling that happens to look like their words: burger buns and bao buns under pear, salam blaadjes and salam leaves under salami, sugar snaps under sugar, king prawns under apples.

**The paths.**

- **Burger buns and bao buns (this release, with AI).** AI read the parent as "bun". `findNamed` → `findOtherFoodsNamed` (`resolver.ts`) found the fold "bun" at rung 1, and that fold is pear's Volapük (`vo`) spelling "bün". An exact spelling is taken without a second question, so both foods were filed under pear as sure parents. The 0.25 copy already had them under pear, through the words.
- **Salam (from 0.25).** 0.25's words read the first word "salam" as salami's Czech (`cs`) spelling "salám". The parent was confirmed, so it has `parent_chosen` and AI never looked again (ticket 40). This release's words would not do it: `parentFromWords` reads a first word only before forms, and "blaadjes" and "leaves" are none.
- **Sugar snaps and king prawns (from 0.25, English).** 0.25 read "sugar" as the first word; king prawns came from a mint "raw king prawns", and "raw" is an English spelling of Open Food Facts' junk food "apples". No language rule reaches these. Only ticket 40's question does.

**Which languages.** `CATALOGUE_LANGUAGES` (`packages/shared/src/lib/ingredient-names.ts`) already lists the 17 catalogue languages that Norish's locales (`packages/i18n/src/messages`) read. On the copy, 21 own foods have a seeded parent their words find only through a spelling outside that list:

- in `vo`, `cs`, `id`, `an` and `ro`: wrong or chance matches;
- in `af`, `fy`, `li` and `hr`: words that are Dutch as well (kaas `af`, mosterd `af`, brood `af`, saus `fy`, mayonaise `li`, paprika `hr`).

The second group exists because spellings are unique by fold and the first language in an entry claims a shared one. Open Food Facts lists `af: Kaas` before `nl: kaas` under `en:cheese` (`applyIngredientSeed`, first claim first). The same rule gave "jam" to yam's `hr` spelling (ticket 32).

**Fix (one rule):** AI's names (`findOtherFoodsNamed`) and a mint's words (`parentFromWords` → `findSeededFoodSpellingsByFolds`) find a seeded food only by a spelling in `CATALOGUE_LANGUAGES`. Own spellings always count. Import rungs 1–2 do not change, so Dutch "paprika" still finds bell pepper (ticket 32).

- **Prerequisite:** where several of an entry's languages share a fold, the seed files it under a language Norish reads (kaas under `nl`, not `af`). In `seedEntriesOf`, list the entry's Norish-language names first. On an instance seeded before, re-stamp the locale of seeded spellings once in `correctSeedOnce` and raise `SEED_CORRECTIONS_VERSION`.
- **Known cost:** Open Food Facts spells bell pepper as bare "paprika" only in `hr`; `nl` has "paprika (vrucht)". So a mint "oranje paprika" gets no parent from its words, and AI's pass files it. "paprika poeder" no longer lands under bell pepper either, which is right.

**Blocked by:** None

**Status:** done

- [x] AI's parent "bun" does not file burger buns under pear.
- [x] A new food "salam blaadjes" is not filed under salami.
- [x] A new food "belegen kaas" is still filed under cheese, also on an instance seeded before this release.

## Implemented (2026-10-22)

- `norishReads(locale)` in `packages/shared/src/lib/ingredient-names.ts`: true for no locale (a seeded `xx:` spelling, or a person's), and for a locale whose `catalogueLanguagesFor` reaches `CATALOGUE_LANGUAGES`, so a person's spelling stamped with a Norish locale ("de-formal") always counts.
- `findOtherFoodsNamed` (`resolver.ts`) drops another food's spelling outside those languages from rungs 1–2 and from slips (`findSlips` now takes a row filter instead of an excluded id). The name lookup of ticket 32 is untouched, so a food found by its own name still counts. `parentFromWords` filters `findSeededFoodSpellingsByFolds` the same way. Import (`resolveTexts`, ticket 41's borrowed readings) is unchanged, no `RUNG_VERSION` bump. The mint recheck goes through both, as ticket 32 noted.
- Seed: `seedEntriesFrom` lists an entry's names Norish-language first (`norishFirst`, stable), so kaas is `nl`. `applyIngredientSeed` (`packages/db/src/repositories/ingredient-seed.ts`) now re-stamps a seeded spelling the entry's own food already holds to the language the file gives it first (`holdersOf` returns locale and `seeded`), on every apply. That also gives a moved spelling its target's language (jam's "jam" was still `hr` after ticket 32's move; the jam entry has `en: jam`).
- Correction: `SEED_CORRECTIONS_VERSION` 3. `correctSeedOnce(fetchImpl = fetch)` passes the version last run to `correctSeed`; coming from below 3 (`NORISH_LANGUAGES_FIRST_IN`) on an instance with a seed applied, it clears the stored etag and last-modified and runs `refreshIngredientCatalogue`, so the file is applied once more at the upgrade boot, before the mint recheck and the first-start cleanup. A fetch that fails throws: the version is not recorded and the next boot retries (the cleared validators also make the nightly job re-apply).
- A first seed now records `correctionsVersion: SEED_CORRECTIONS_VERSION` beside `rungVersion: 0`: it was read with every correction, so a new instance does not fetch the file twice on its first boot.
- Tests (all red first): `review.test.ts` "finds no parent: AI's bun is not pear's Volapük bün, nor salam salami's Czech salám" (salam is then a slip from salami's English name, asked about, answered none); `parent-from-words.test.ts` "files under a seeded spelling only in a language Norish reads" (burger buns no parent, belegen kaas under cheese); `catalogue-seed.test.ts` "files a spelling an entry's languages share under the one Norish reads, also on an instance seeded before". Test helper `seedEntryIn` in `__tests__/helpers/seed-entries.ts`.
- ADR-0037 amended (2026-10-22); release-notes line under Fixes in 0.26.0-beta.

**For Mike.**

- (Superseded by the review fix below: the boot downloads nothing.)
- The known cost holds: bell pepper's bare "paprika" is only `hr`, so a new "oranje paprika" gets no parent from its words with AI off, and AI's "paprika" finds the spice by name.
- Sugar snaps and king prawns (English, from 0.25) are untouched by this rule; ticket 40's question covers them.

## Review fixes (2026-10-22)

- **No boot download.** `correctSeedOnce()` (no fetch argument) coming from below `NORISH_LANGUAGES_FIRST_IN` only clears the stored etag and last-modified and records the version; the nightly `refreshIngredientCatalogue` then fetches the file whole and its apply re-stamps the languages. An offline instance no longer throws every boot. Until that refresh, an instance seeded before keeps "kaas" as `af`, so a new "belegen kaas" gets no parent from its words with AI off (AI's pass files it). No upgrade note mentioned the download, so none changed. Test: `catalogue-seed.test.ts` "files a spelling an entry's languages share..." (a fetch that throws at boot is never called; the refresh after re-stamps).
- 2026-10-22 (ticket 60): `NORISH_LANGUAGES_FIRST_IN` is gone. No shipped release ran the corrections, so every real upgrade comes from 0; the validators are forgotten whenever the corrections run on a seeded instance. A later `SEED_CORRECTIONS_VERSION` bump therefore makes the nightly refresh apply the file once more, which is harmless.
