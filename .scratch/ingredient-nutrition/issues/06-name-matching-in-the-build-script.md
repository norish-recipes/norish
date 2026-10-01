# 06: Name matching in the build script

**What to build:** The build script matches taxonomy entries that have no numbers from a code against CIQUAL, USDA and CoFID food names, and commits the matches in the source table keyed by OFF id, at step 7 of the lookup order. Names are folded (lowercase, accents and punctuation removed), then matched exactly, then normalised. Normalising drops brackets, filler words and raw-state words ("raw", "fresh", "average", "plain"), singularises, and compares sets of words. Words that change the food are kept (whole, dried, cooked, powder, smoked, salted). When several dataset foods share a key, the match is taken only if their calories agree within 10%. It runs only in the build script, never on an instance.

**Blocked by:** 01

**Status:** done, pending gates and review

- [x] "Red onion" matches "Onions, red, raw"; "whole rice flour" does not match "rice flour".
- [x] An ambiguous key whose candidates disagree by more than 10% gives no match.
- [x] Wine reads about 77 kcal per 100 g, not pure alcohol.
- [x] The panel shows a matched Ingredient's source with "matched by name".
- [x] CoFID joins the Ingredients page credit.
- [x] A hand-checked sample of 50 matches is recorded in the ticket's comments.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented in `tooling/nutrition/src/names.ts`. Names are matched on the entry's English and language-free names against CIQUAL's English names, USDA's and CoFID's. French names and the Canadian Nutrient File are not used, so this yields 148 matches against the research's 232.
- Found while sampling: compared as word *sets*, "tomatoes in tomato juice" matched "Tomato juice" and "chocolate and white chocolate" matched "Chocolate, white". Words are now compared as a multiset, each as often as it occurs.
- Hand-checked sample of 50 (deterministic shuffle of the matches, after that fix): all 50 plausible. Bilberry → "Huckleberries, raw" is borderline, as in the research; coriander → "Coriander, fresh" reads the leaf.

| Entry | Matched food | kcal |
|---|---|---|
| en:acorn-squash | cofid:13-353 Squash, acorn, raw | 40 |
| en:almond-flour | usda:2261420 Flour, almond | 578 |
| en:arctic-char | ciqual:26171 Arctic char, raw | 103 |
| en:baby-spinach | usda:1999632 Spinach, baby | 21 |
| en:beef-extract | cofid:17-514 Beef extract | 179 |
| en:bilberry | usda:169808 Huckleberries, raw (Alaska Native) | 37 |
| en:blue-stilton | cofid:12-367 Cheese, Stilton, blue | 410 |
| en:brown-basmati-rice | cofid:11-866 Rice, brown, basmati, raw | 355 |
| en:cassava-flour | usda:2512377 Flour, cassava | 359 |
| en:chicken-egg-yolk | cofid:12-939 Eggs, chicken, yolk, raw | 347 |
| en:chocolate | cofid:17-491 Chocolate, plain | 510 |
| en:chocolate-bar | ciqual:31120 Chocolate, bar (average) | 552 |
| en:cod-liver | ciqual:26141 Cod liver, raw | 623 |
| en:coho-salmon | ciqual:26223 Coho salmon, raw | 147 |
| en:cooked-carrot | ciqual:20353 Carrot, cooked (average) | 33 |
| en:cooked-lardoons | ciqual:28504 Lardoons, plain, cooked | 324 |
| en:cooked-wild-rice | usda:168897 Wild rice, cooked | 101 |
| en:coriander | ciqual:11094 Coriander, fresh | 22 |
| en:crouton | usda:172751 Croutons, plain | 407 |
| en:demerara-sugar | cofid:17-061 Sugar, Demerara | 394 |
| en:duck-foie-gras | ciqual:8328 Foie gras, duck, raw | 600 |
| en:glacé-cherry | cofid:14-335 Cherries, glace | 294 |
| en:lancashire-cheese | cofid:12-488 Cheese, Lancashire | 382 |
| en:lean-pork | cofid:18-608 Pork, lean, average, raw | 116 |
| en:long-grain-brown-rice | usda:169703 Rice, brown, long-grain, raw | 367 |
| en:long-grain-white-rice | cofid:11-861 Rice, white, long grain, raw | 355 |
| en:melon-seed | cofid:14-826 Melon seeds | 583 |
| en:oak-leaf-lettuce | ciqual:20295 Lettuce, oak-leaf, raw | 11 |
| en:orange-juice-from-concentrate-with-pulp | ciqual:2012 Orange juice, from concentrate | 46 |
| en:oxtail | cofid:18-419 Oxtail, raw | 171 |
| en:pacific-cod | ciqual:26125 Pacific cod, raw | 65 |
| en:paprika-powder | ciqual:11049 Paprika, powder | 318 |
| en:pasteurised-goat-milk | cofid:12-328 Milk, goats, pasteurised | 62 |
| en:pastry | ciqual:23900 Pastry (average) | 279 |
| en:pea | cofid:13-438 Peas, raw | 83 |
| en:phyllo-dough | usda:172791 Phyllo dough | 299 |
| en:pink-grapefruit-juice | usda:167774 Grapefruit juice, pink, raw | 39 |
| en:port | cofid:17-234 Port | 157 |
| en:quail-eggs | ciqual:22050 Quail egg, raw | 154 |
| en:quinoa-flour | usda:2512372 Flour, quinoa | 378 |
| en:raw-cucumber-pulp-and-peel | usda:168409 Cucumber, with peel, raw | 15 |
| en:raw-golden-redfish | ciqual:26210 Golden redfish, raw | 90 |
| en:raw-sauerkraut | cofid:13-336 Sauerkraut | 9 |
| en:red-leicester | cofid:12-485 Cheese, Red Leicester | 403 |
| en:red-seedless-grape | usda:2346412 Grapes, red, seedless, raw | 77 |
| en:romano-cheese | usda:171249 Cheese, romano | 387 |
| en:tea-leaf | ciqual:18076 Tea leaf | 232 |
| en:whole-fresh-eggs | usda:171287 Egg, whole, raw, fresh | 143 |
| en:worcestershire-sauce | cofid:17-723 Worcestershire sauce | 113 |
| en:yeast-extract | cofid:17-517 Yeast extract | 180 |

- The checks named in the ticket: en:red-onion → "Red onion, raw" (CIQUAL) and en:wine → "Wine (average)", 76.7 kcal.
