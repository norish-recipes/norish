# Ingredient Nutrition without AI

**Status:** ready-for-agent

Settled in a `/grill-with-docs` session on 2026-10-01, from `research.md`, `research-coverage.md` and `legacy-lines.md`. The lasting decisions are in ADR-0039 and its amendments to ADR-0037 and ADR-0038. The vocabulary is CONTEXT.md's **Ingredient Nutrition**, **Flagged Ingredient**, **Parent Ingredient** and **Nutrition Information**. Tickets are in `issues/`.

Amended by a second session on 2026-10-02 about spoon measures. It added stories 52–68, the **Spoon measures** decisions and tickets 14–18, and changed stories 4, 5, 7, 16, 19, 27 and 44. What it found outside spoons is in `piece-weights.md`, for a later session.

## Problem Statement

Most recipes a household imports or types carry no Nutrition Information. Today the only way to get some is the language model's estimate, so an instance without AI never shows any, and one with AI shows a number nobody can trace or correct. The catalogue already knows which food each recipe line names, but it knows nothing about that food's calories, fat, carbohydrates or protein.

On instances with recipes from before the catalogue existed, many lines don't even point at a known food. "Salt to taste", "verse peterselie" and "ground cumin" were minted as Flagged Ingredients of their own, with no parent. Those lines would stay blank however good the nutrition data is.

Recipes measure seasonings, oils, sauces and baking ingredients in teaspoons and tablespoons, and those lines reach grams only through a density. USDA weighed a spoon or cup of thousands of foods, but CIQUAL weighs none, so an Ingredient whose numbers come from CIQUAL and whose taxonomy entry has no USDA code never reaches a density of its own. Cumin, butter, breadcrumbs, soy sauce and vinegar are among them, and 14 of the 33 spoon and volume lines in the dev database were left out of their totals. The words for units also collide across languages. "T" is read as a teaspoon, "Stück" as a chunk and "scheutje" as a dash that counts as nothing, because a server reads the units map from a JSON column whose key order decides which entry claims a word two entries share.

## Solution

Every Ingredient gets Ingredient Nutrition: calories, fat, carbohydrates and protein per 100 g, plus a piece weight and a density where known. The numbers come from open food datasets (CIQUAL, CALNUT, USDA) joined through the codes the Open Food Facts taxonomy already carries. A recipe with no supplied Nutrition Information then shows nutrition per serving, worked out from its lines:
- It names the lines it couldn't count.
- It says when it is estimated (borrowed from a parent food).
- It credits the datasets it used.

A household that disagrees with a number ("our milk is skimmed") corrects it for itself, and that correction is the last word for that household.

Legacy lines reach seeded Ingredients without AI in three ways:
- the resolver learns to strip phrases like "to taste";
- a new unsure Ingredient is placed under the known food its name ends with;
- a one-time pass, repeated whenever those rules improve, re-checks the old flagged Ingredients.

Spoon measures count without AI too:
- a reviewed list of density fixes gives a food the spoon weight USDA measured for it, whichever dataset its numbers come from;
- a few hand-picked groups whose foods share a form (spices, sauces, syrups, vinegars, creams) carry a density their members borrow, even past a parent that never lends its numbers;
- every word in the units map names one unit, chosen in the file.

A total names every line it left out, and why, behind an asterisk on its calories. It says it is estimated only when borrowed facts carry a tenth of its calories. The Ingredient panel shows a spoon weight in the measure the household's recipes use for that food.

## User Stories

1. As a home cook on an instance without AI, I want my recipes to show nutrition per serving, so that I can plan meals with calories and macros in mind.
2. As a home cook, I want the nutrition shown to be worked out from the recipe's own lines, so that changing an amount changes the numbers.
3. As a home cook, I want a recipe's supplied nutrition to always win over a worked-out one, so that the author's numbers are never overwritten.
4. As a home cook, I want to see which lines weren't counted and why, so that I know how incomplete the total is and where to fix it.
5. As a home cook, I want "salt to taste" and "a pinch of nutmeg" listed as seasoning among the lines not counted, so that nothing is left out of a total without my knowing.
6. As a home cook, I want "olive oil for frying" (no amount) named under "Not counted", so that I know the frying oil isn't in the total.
7. As a home cook, I want a total to say it is estimated when the lines that borrowed a parent food's facts bring at least a tenth of its calories, so that I don't mistake an approximation for a measured value, and a borrowed teaspoon of paprika doesn't mark every total.
8. As a home cook, I want "2 onions" counted through an onion's weight, so that recipes written in pieces still get nutrition.
9. As a home cook, I want "1 cup milk" and "2 tbsp olive oil" counted through their density, so that recipes written in volumes get nutrition.
10. As a home cook, I want "1 cup flour" left uncounted when Norish doesn't know flour's density, rather than guessed as water, so that a total is never off by half silently.
11. As a home cook, I want nutrition shown per serving, so that it matches how I eat the dish.
12. As a home cook, I want a recipe whose every line is uncounted to show no worked-out total, so that I am not shown a misleading zero.
13. As a home cook, I want a small credit line naming the datasets behind a total, so that I can trust where the numbers came from.
14. As a home cook, I want an Ingredient's panel to show its numbers per 100 g and the dataset food they came from ("Onion, raw · CIQUAL 2025"), so that I can check them.
15. As a home cook, I want an Ingredient's panel to say when its numbers are borrowed ("from onion"), so that I understand why a red onion reads like an onion.
16. As a home cook, I want an Ingredient's panel to show its piece weight, and its spoon weight in the measure my household's recipes use for it ("a teaspoon of cumin weighs 2 g"), each with its source, so that I can see how pieces and spoons become grams.
17. As a household member, I want to correct an Ingredient's numbers by picking a different dataset food ("Milk, semi-skimmed, UHT"), so that the numbers match what we actually buy.
18. As a household member, I want to correct an Ingredient's numbers by typing them from a pack label per 100 g, so that foods no dataset knows still count correctly.
19. As a household member, I want to correct an Ingredient's piece weight and spoon weight the same way, the spoon weight in the measure our recipes use, so that our "medium onion" or our flour counts right.
20. As a household member, I want to correct any Ingredient, including seeded ones like milk, without asking an administrator, so that fixing our numbers is never blocked.
21. As a household member, I want my correction to apply for everyone in my household, so that we all see the same totals.
22. As a household member, I want my correction to stay invisible to other households, so that our habits don't change their numbers.
23. As a household member, I want the most recent correction to win when two of us correct the same Ingredient, so that there is always one value.
24. As a household member, I want to remove a correction and return to the dataset's numbers, so that a mistake is easy to undo.
25. As a household member, I want other members to see my correction without reloading, so that the household's view stays consistent.
26. As a household member, I want a child food that borrows from a corrected parent to borrow the correction, so that correcting "onion" fixes "red onion" too.
27. As a home cook, I want a line left out for a fact the Ingredient's panel holds (a spoon weight, a piece weight, its numbers) to open that panel, so that I can fix what's missing in one step.
28. As a home cook, I want milk not to read as skimmed milk by default, so that common recipes aren't under-counted.
29. As a home cook, I want corn, broths and pistachios to carry the right dataset food, so that the taxonomy's wrong codes don't reach my totals.
30. As a home cook, I want beef, pork, lamb, cumin and beans to have numbers, so that the most-used foods the taxonomy leaves blank still count.
31. As a home cook, I want white wine counted as wine, not pure alcohol, and cinnamon as cinnamon, not an average spice, so that a food's own data wins over a parent's.
32. As a home cook, I want brandy left uncounted rather than counted as pure alcohol at 660 kcal, so that a bad borrow never silently inflates a total.
33. As a home cook, I want a food I placed under a parent on the Ingredients page to borrow that parent's numbers, so that organising my catalogue improves my totals.
34. As a home cook with old recipes, I want "salt to taste" lines to land on salt, so that my legacy recipes join the catalogue.
35. As a home cook with old recipes, I want "verse peterselie" to sit under peterselie and borrow its numbers, so that legacy lines get nutrition without AI.
36. As a home cook, I want a new unsure Ingredient like "ground cumin" placed under cumin, still flagged, so that it gets an aisle and numbers right away while staying in front of me for review.
37. As a home cook, I want an Ingredient I marked distinct never to be merged later, so that my decisions stick.
38. As a home cook, I want an Ingredient I renamed or parented myself left alone by the re-check, so that Norish never undoes my work.
39. As a home cook in any of Norish's languages, I want "naar smaak", "n. B." and "al gusto" stripped like "to taste", so that legacy lines resolve in my language.
40. As a home cook typing offline, I want "salt to taste" matched the same way before and after it syncs, so that my pantry and list behave consistently.
41. As an administrator, I want editing the units map to change which phrases are stripped, so that I can add my households' phrasing.
42. As an administrator, I want the source numbers to arrive with releases and apply at boot, so that I don't operate another data fetch.
43. As an administrator, I want a failed apply of the source numbers to leave the last good ones, so that a bad release never blanks nutrition.
44. As an administrator on an instance with AI, I want the language model to estimate only the lines Ingredient Nutrition can't count, seasoning excepted, so that AI cost and invention are kept to the gaps.
45. As an administrator, I want the Ingredients page to credit CIQUAL, CALNUT, USDA and CoFID beside Open Food Facts, so that the instance meets the datasets' attribution terms.
46. As a signed-in user downloading the catalogue export, I want each Ingredient's source codes and numbers included, so that the ODbL share-alike is honoured.
47. As a household member, I want my household's corrections never included in the catalogue export, so that our data stays ours.
48. As a Norish maintainer, I want the source table rebuilt monthly by a workflow that opens a pull request, so that new dataset editions and name matches arrive without anyone remembering.
49. As a Norish maintainer, I want new name matches to show up as a diff in that pull request, so that a person reads them before they reach instances.
50. As a Norish maintainer, I want a failed monthly run to just fail and retry next month, so that a dataset host being down never blocks a release.
51. As a Norish maintainer, I want a fix-list entry pointing at a dataset food that no longer exists to fail the build script, so that a broken fix never ships.
52. As a home cook on an instance without AI, I want "1 tl komijn" and "2 el paneermeel" counted through the weight USDA measured for a spoon of that food, so that spooned seasonings, sauces and baking ingredients count.
53. As a home cook, I want a spice blend or a sauce nobody listed to take its group's spoon weight, so that garam masala and sambal count too.
54. As a home cook, I want dried herbs, cheese and other foods whose group holds different forms never to take a group's spoon weight, so that a cup of grated cheese is never weighed as milk.
55. As a home cook, I want a sauce to borrow a spoon weight even though an average sauce's calories are never lent, so that a rule about calories doesn't block what a spoonful weighs.
56. As a home cook, I want the total's calories to carry an asterisk and "N lines not counted" that opens the list on click or tap, so that the card stays short and the list is one tap away.
57. As a home cook, I want lines the language model estimated in that same list, marked as estimated by AI, so that every line that isn't plainly counted is in one place.
58. As a household member, I want an Ingredient's panel to show no spoon weight for a food none of our recipes measure by volume, so that onion's panel doesn't ask about cups of onion.
59. As a household member, I want the panel to ask for a spoon weight when one of our recipes measures the food by volume and none is known, so that "1 tl komijn" under "Not counted" is fixed in one step.
60. As a home cook, I want "1 T olive oil" read as a tablespoon, so that recipes using the American abbreviation count all their oil.
61. As a home cook, I want "2 stuks uien" and "2 Stück Zwiebeln" read as pieces, so that they count through an onion's weight.
62. As a home cook, I want "een scheutje olie" read as a splash and listed as not counted, so that a pour of oil is never hidden as nothing.
63. As a home cook, I want "2 heaped tsp cumin seeds" read as teaspoons, so that British recipes count their spoons.
64. As a home cook with older recipes, I want lines stored as a chunk to count as pieces, so that the "stuk" lines parsed before the fix count too.
65. As a home cook, I want a cup of cream weighed as fluid cream, not whipped cream, so that cream isn't counted at half.
66. As a home cook, I want vegetable stock to have numbers like chicken and beef stock, so that a vegetable soup's total isn't missing its base.
67. As a Norish maintainer, I want a test to fail when two units in the default units map claim the same word, so that which unit a word means is chosen in the file, not by the database's key order.
68. As a Norish maintainer, I want density fixes checked by the build script and reviewed in the source table's diff, so that every spoon weight traces to a USDA food a person chose and a broken one never ships.

## Implementation Decisions

**Sources and the source table**
- The datasets are CIQUAL 2025 (2020 for codes 2025 dropped), CALNUT, USDA SR Legacy and USDA Foundation, all joined through taxonomy codes. Name matches use CIQUAL, USDA and CoFID names.
- Rejected: NEVO (licence), the Canadian Nutrient File (adds nothing), product databases, and fuzzy or head-noun matching.
- A build script, in the repo's tooling, reduces the datasets to one committed **source table** holding:
  - per dataset code: kcal, fat, carbohydrate and protein per 100 g;
  - per code: piece weight and density from USDA portions;
  - name matches, keyed by OFF id;
  - Norish's **fix list**: OFF id → dataset food, about 25–30 entries;
  - the **never-lend list** of OFF ids.
- Parsing rules: "traces" counts as 0 and "< x" as x/2. A row without all four values is skipped. USDA energy falls back to Atwater. Where CIQUAL and USDA disagree, CIQUAL wins.
- Name matching: fold names, match exactly, then normalised. Normalising drops brackets, filler words and raw-state words, singularises, and compares sets of words. Food-changing words are kept. When several foods share a key, the match is taken only if their calories agree within 10%.
- The table carries a version. At boot, an instance applies it when the version differs from the one recorded beside the seed state; a failed apply leaves the last good one. A monthly scheduled workflow (plus manual dispatch) reruns the script and opens or updates one pull request when the table changed. A failure gates nothing.

**Seed**
- The taxonomy parser keeps each entry's nutrition properties instead of discarding every property: CIQUAL code and proxy, USDA codes, other CIQUAL-keyed codes, `average_weight_per_unit` and `density_g_per_ml`.
- Seeded Ingredients store them, so a code fixed upstream arrives with the nightly fetch. A re-apply of an unchanged file still changes nothing.

**The Ingredient Nutrition module (one new deep module, in the shared-server ingredients area)**
- Interface: given Ingredient ids and a household, return each Ingredient's resolved nutrition:
  - the four numbers per 100 g, the piece weight and the density, each with its **source** (household correction, fix list, dataset code, name match, or borrowed from a named ancestor);
  - whether it was borrowed.
- Lookup order, first hit wins:
  1. household correction
  2. fix list
  3. own CIQUAL code, then own CIQUAL proxy
  4. CALNUT
  5. own USDA codes
  6. other CIQUAL-keyed codes
  7. name match
  8. the nearest Parent Ingredient with numbers of its own, along Norish's tree, at any distance, skipping the never-lend list (a never-lend ancestor ends the walk)

  Piece weight and density follow the same order independently. The density has two exceptions, under **Spoon measures**: a density fix comes first, and the never-lend list doesn't end its walk.
- It is the only place that knows this order. The panel read, the recipe read and the AI estimator all go through it.

**Recipe arithmetic (a new pure function in the shared lib, beside the line cost)**
- Input: a recipe's lines (amount, unit id, Ingredient), its servings, and the resolved nutrition per Ingredient.
- Output: per-serving numbers, the uncounted lines with a reason each, an estimated flag, and the set of sources used.
- How a line reaches grams:
  - weight units convert directly;
  - piece, clove, slice, chunk and no unit go through the piece weight;
  - ml, tsp (5), tbsp (15) and cup (240) go through the density, using the existing unit table's volume definitions;
  - pinch, dash and to_taste are never counted and are listed as seasoning;
  - anything else, a missing amount, or missing numbers puts the line in the uncounted list.
- A recipe with no counted line yields no total.

**Reading**
- The recipe page shows the worked-out nutrition only when the recipe has no supplied Nutrition Information.
- It is computed on read for the reader's household and never stored in the recipe's nutrition columns.
- The Ingredient panel shows the resolved nutrition with its sources. The credit line names the datasets in the sources used.

**Household corrections**
- A new table keyed by user and Ingredient, read by every member of the user's household (the ingredient store preference pattern). The most recent update wins within a household.
- A correction holds either a dataset food reference or four label numbers, plus optional piece weight and density, each also a reference or a number.
- Any household member may write one for any Ingredient. The ingredient permission policy doesn't apply, because a correction is the household's data, not an edit to the Ingredient.
- Changes are announced to the household's realtime channel and merged by identity on the client.
- Corrections are never in the catalogue export and are never touched by a table apply.

**Resolver changes (ADR-0037 as amended)**
- Rung 2 additionally strips a units-map phrase at either end of the text. This lives in the shared spelling-keys module, so client and server compute the same food key.
- The default units map gains "to serve", "for garnish" and "optional" entries in every locale.
- Rung 4 gives a new mint the longest seeded alias its text ends with, as whole words, as its Parent Ingredient. The parent is not marked person-chosen, and the mint stays flagged.

**Kept distinct and the re-check pass**
- Ingredients gain a "kept distinct" marker (schema migration; existing rows start unmarked), set by Mark distinct.
- A startup pass re-resolves Flagged Ingredients with no OFF id through the resolver's rungs 1–2:
  - where they now resolve, it merges into the target;
  - otherwise it applies the rung-4 parent;
  - it skips Ingredients that are kept distinct, renamed by a person, or have a person-chosen parent.
- It runs once per **rung version**, recorded in the seed state beside the existing "merged existing" marker.

**AI**
- The nutrition estimator is given the counted lines' numbers as an appended prompt section (ADR-0016) and estimates only the uncounted lines, seasoning excepted.
- A recipe whose every line counts gets no estimate run.
- The stored estimate is the gap's share, one per line, kept apart from the recipe (ticket 12).

**Credit and export**
- The Ingredients page credits CIQUAL 2025 (ANSES), CALNUT, USDA FoodData Central and CoFID beside Open Food Facts.
- The catalogue JSON export gains each Ingredient's source codes and resolved dataset numbers, without corrections.

**Spoon measures (2026-10-02)**
- One size per unit, whatever language the word was written in: a teaspoon is 5 ml, a tablespoon 15 ml, a cup 240 ml.
- **Density fixes** are Norish's third list in the source table, beside the fix list and the never-lend list.
  - Each maps an OFF id to a USDA food, used for the density alone; the Ingredient's numbers keep their own source.
  - For the density, a density fix comes right after the household's correction, before the fix list.
  - The build script fails, writing nothing, on an entry whose id the taxonomy lacks or whose food is not a USDA food with a density.
  - The panel names its source like a fix: "Spices, cumin seed · USDA, chosen by Norish".
  - The first entries: cumin, butter, margarine, baking powder, dry yeast, cocoa powder, breadcrumbs, soy sauce, mustard, mayonnaise, tomato paste, Worcestershire sauce, pesto, vinegar, white wine, grated parmesan and rice. Fish sauce, which has no numbers either, goes on the fix list instead.
- **Group densities** are density fixes on hand-picked group entries whose foods share a form, each pointing at a representative USDA food chosen in review:
  - `en:spice`, which `en:mixed-spices` and its blends borrow through;
  - `en:sauce`;
  - the syrup entries, which the taxonomy scatters: `en:syrup`, `en:sugar-syrup`, `en:glucose-syrup` and `en:invert-sugar-syrup`;
  - `en:vinegar`;
  - `en:cream`, added after implementation (2026-10-02, with Mike): every poured or spooned cream weighs 0.96–1.01 g/ml, tighter than the sauces, so "room" and "kookroom" count; cream still never lends its numbers.

  Oils already carry the taxonomy's 0.92 on `en:oil` and `en:vegetable-oil`. Dairy as a whole, cheese, herbs, fruit, vegetables and meat never get one.
- **Never-lend** ends only the numbers' walk. A density walks past it, so every sauce borrows `en:sauce`'s and desiccated coconut borrows coconut's. Piece weights keep the list for now (`piece-weights.md`).
- A total is **estimated** when the counted lines that borrowed any fact bring at least 10% of its counted calories, or when a line's share came from the language model.
- **Lines left out**:
  - Each carries one reason: seasoning (pinch, dash, to taste), no amount, a measure with no size, no spoon weight, no piece weight, or no numbers (a line naming no Ingredient included).
  - Seasoning is never sent to the language model.
  - The recipe card puts an asterisk after the calories and "N lines not counted ▸" beneath the numbers, and opens the list in place on click or tap. Nothing shows when every line counted.
  - Lines the language model estimated join that list, marked as estimated by AI. Lines that only borrowed are not listed.
  - Only lines left out for no spoon weight, no piece weight or no numbers link to the Ingredient's panel.
- **The panel's spoon row** replaces the fixed cup:
  - it shows only when a recipe the household can open measures the Ingredient by volume;
  - it states the weight of the measure those lines use most ("a teaspoon of cumin weighs 2 g"), with millilitre to litre lines read per 100 ml;
  - a correction is typed in that measure and stored as the same density;
  - with no density known, it asks for one in that measure.
- **Unit words**:
  - Every folded word in `units.default.json` names one unit, chosen in the file, and a test fails on a word two units claim.
  - "T" (tablespoon) and "t" (teaspoon) are matched with their case wherever a unit word is read.
  - The choices that change a count: stuk, stuks, Stück, Stücke, pezzo and pezzi are pieces; scheutje is a splash; dozen is a dozen. Review picks the other owners.
  - The British "heaped" spoons join the heaping ones.
  - An administrator's overridden map is not rewritten.
  - Lines already stored keep their unit. A stored chunk counts as pieces; an old "T" line stays a teaspoon, because nothing tells it from one.
- **Plain fixes**: the density picker skips "whipped" portions, vegetable broth joins the fix list, and agave syrup's 0.92 is checked against USDA's portions.

## Testing Decisions

- A good test drives a seam from the outside and asserts what a household would see: numbers, uncounted lines, sources, merges. It never asserts on query shapes, internal helpers or intermediate tables.
- **Recipe arithmetic** gets table-driven scenario tests. Prior art: the line cost tests, which argue each rule as a named scenario. Cover:
  - weight, pieces, cloves and volumes;
  - pinch and to taste;
  - a missing amount, a unit with no grams, missing numbers;
  - estimated propagation;
  - per-serving division;
  - the all-uncounted case.
- **The Ingredient Nutrition module** is tested against a real database. Prior art: the resolver tests built on the repository test base. Cover:
  - every step of the lookup order;
  - own code before an ancestor's code (white wine);
  - borrowing across several levels and past an ancestor without numbers;
  - the never-lend list ending the walk;
  - re-parenting changing the borrow;
  - household isolation, and most-recent-wins inside a household;
  - a correction on a parent reaching a child;
  - a table re-apply leaving corrections untouched.
- **The resolver**, through its existing tests: phrase stripping at both ends and not in the middle, units-map edits taking effect, client/server food-key parity in the spelling-keys tests, and the trailing-alias parent with longest-wins and flag kept.
- **Seed and startup**, through the existing parse-taxonomy, catalogue-seed and startup seed tests:
  - codes kept;
  - an unchanged re-apply is a no-op;
  - the table applies only on a version change, and a failed apply leaves the old one;
  - the re-check pass merges, parents, skips person decisions, and runs once per rung version.
- **The build script** is tested on small fixture extracts of each dataset:
  - row parsing;
  - the normalisation and ambiguity rules, with the "red onion" / "whole rice flour" cases;
  - a missing fix-list target failing the run.
- **The AI estimator**, through its existing tests: the counted lines arrive as a section, and the all-counted case runs nothing.
- **Browser**: one spec in the production-like E2E harness's offline (no AI) project covers:
  - a worked-out total;
  - "Not counted";
  - an estimated total;
  - a correction affecting only its household;
  - a legacy "salt to taste" line landing on salt.
- **Spoon measures** (tickets 14–18) go through the same seams:
  - the recipe arithmetic: a reason for each kind of line left out, seasoning listed, a chunk counted as pieces, and the 10% rule both ways (a borrowed teaspoon of paprika leaves a total counted; a cup of flour on a borrowed density marks it);
  - the Ingredient Nutrition module: a density fix before the fix list while the numbers keep their source, a group density reaching a child, and a density walking past a never-lend parent where the numbers stop;
  - the units: no word claimed twice in the default map, "T" against "t", stuk as a piece, scheutje as a splash, heaped spoons;
  - the build script: a density fix naming a missing id, a food that isn't USDA's or one with no density fails the run, and whipped portions are skipped;
  - the panel: the spoon row only where the household's recipes measure the food by volume, in the measure they use most, asking when no density is known;
  - the browser spec: a spoon line counted through a density fix, the asterisk's list with reasons, and a corrected teaspoon weight changing one household's total.

## Out of Scope

- Food Groups, or any marking of group nodes like vegetable or meat beyond their having no numbers.
- Sending fixes upstream to Open Food Facts.
- Product (brand) nutrition, Open Food Facts product exports, and per-category averages.
- NEVO, the Canadian Nutrient File, Frida and other datasets.
- Fuzzy or head-noun name matching on instances or in the build script.
- An instance-wide, administrator-editable correction layer, or editing the fix list on an instance.
- A generic spoon weight, water's density, or a group density beyond the hand-picked groups.
- Sizing a unit by region or language: a 250 ml metric cup, a 20 ml Australian tablespoon.
- Weights for measures with no size (glass, handful, sprig, bunch) and for containers (can, jar, pack).
- A density-only name match against USDA's names.
- Piece weights borrowed across sizes, size words stored as units, "kilo", and the English "paprika" alias. `piece-weights.md` keeps them for a later session.
- Nutrients beyond calories, fat, carbohydrates and protein.
- The mobile app, which is parked.
- Measuring on a real instance before building. The research's usage-weighted figures are taken as sufficient.

## Further Notes

- Coverage expected from the research: about 78% of taxonomy entries get numbers and 95% of recipe mentions are covered. With the fix list, about 98% of recipe mentions get plausible numbers.
- CIQUAL's terms require the source and edition date and forbid altering the data. A household's correction is shown as the household's own, never as CIQUAL's.
- Re-check pass and catalogue ticket 19 (seed and backfill mint through the resolver): the pass should resolve through the resolver, not add another copy of its rules.
- Spoon measures were measured on 2026-10-02 against the dev database with the real modules. Of 85 commonly spooned foods, 53 had a density; the first density fixes bring that to 73 and the group densities to 78. In the dev recipes, 10 of the 14 spoon and volume lines left out then count, and 11 with the vegetable broth fix. 763 of the 1,066 catalogue entries with CIQUAL numbers have no USDA code, so a density reaches them only by borrowing.
- A server reads the units map from a jsonb column, which orders keys shortest first, and `normalizeUnit` takes the first entry that claims a word. Until ticket 14, the 68 words two entries shared were resolved by key length.
