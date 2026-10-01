# 05: Norish's fix list

**What to build:** A curated list in the source table points an OFF id at the dataset food it should use, at step 2 of the lookup order, above every code. It fixes the taxonomy's wrong codes and fills its most-used gaps. It is Norish's own, the same on every instance, not editable there and not sent upstream: a household that disagrees corrects its own (ticket 08), which outranks the list.

**Blocked by:** 01

**Status:** done, pending gates and review

- [x] The list covers at least: milk (not skimmed), corn (sweet corn, not dry grain), chicken broth (not raw chicken), beef broth (not dehydrated), pistachio (not macadamia), beef, pork, lamb, cumin, beans, kidney beans, black beans, beer and the common spirits.
- [x] Each entry names a dataset food, never typed numbers, and is reviewed against the usage list in `research-coverage.md`.
- [x] The panel shows a fixed Ingredient's source as the dataset food, noting that Norish chose it.
- [x] An entry whose dataset food no longer exists fails the build script, not the instance.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented in `tooling/nutrition/src/lists.ts`, 21 entries. Wrong codes: milk (whole, average), corn (sweet, raw), chicken and beef broth (ready-to-serve), pistachio, hot sauce, sherry. Gaps: beef, pork, lamb, cumin, beans, kidney and black beans, barley, smoked sausage. Spirits that would borrow pure alcohol: beer, brandy, cognac, whiskey, tequila. These were reviewed against `research-coverage.md`'s usage lists (its "wrong values" and "uncovered and used by recipes" tables). Vegetable, meat, seed and milkfat are left out as product questions.
- The build fails, writing nothing, on a fix naming a food no dataset has or an entry the taxonomy dropped (`SourceTableError`). The panel shows a fixed food's source as "{food} · {dataset}, chosen by Norish".
