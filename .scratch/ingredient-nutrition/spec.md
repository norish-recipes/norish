# Ingredient Nutrition without AI

**Status:** ready-for-agent

Settled in a `/grill-with-docs` session on 2026-10-01, from `research.md`, `research-coverage.md` and `legacy-lines.md`. The lasting decisions are in ADR-0039 and its amendments to ADR-0037 and ADR-0038. The vocabulary is CONTEXT.md's **Ingredient Nutrition**, **Flagged Ingredient**, **Parent Ingredient** and **Nutrition Information**. Tickets are in `issues/`.

## Problem Statement

Most recipes a household imports or types carry no Nutrition Information. Today the only way to get some is the language model's estimate, so an instance without AI never shows any, and one with AI shows a number nobody can trace or correct. The catalogue already knows which food each recipe line names, but it knows nothing about that food's calories, fat, carbohydrates or protein.

On instances with recipes from before the catalogue existed, many lines don't even point at a known food. "Salt to taste", "verse peterselie" and "ground cumin" were minted as Flagged Ingredients of their own, with no parent. Those lines would stay blank however good the nutrition data is.

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

## User Stories

1. As a home cook on an instance without AI, I want my recipes to show nutrition per serving, so that I can plan meals with calories and macros in mind.
2. As a home cook, I want the nutrition shown to be worked out from the recipe's own lines, so that changing an amount changes the numbers.
3. As a home cook, I want a recipe's supplied nutrition to always win over a worked-out one, so that the author's numbers are never overwritten.
4. As a home cook, I want to see which lines weren't counted, so that I know how incomplete the total is.
5. As a home cook, I want "salt to taste" and "a pinch of nutmeg" to count as nothing without being listed as missing, so that the "Not counted" list only shows what matters.
6. As a home cook, I want "olive oil for frying" (no amount) named under "Not counted", so that I know the frying oil isn't in the total.
7. As a home cook, I want a total that relied on a parent food's numbers to say it is estimated, so that I don't mistake an approximation for a measured value.
8. As a home cook, I want "2 onions" counted through an onion's weight, so that recipes written in pieces still get nutrition.
9. As a home cook, I want "1 cup milk" and "2 tbsp olive oil" counted through their density, so that recipes written in volumes get nutrition.
10. As a home cook, I want "1 cup flour" left uncounted when Norish doesn't know flour's density, rather than guessed as water, so that a total is never off by half silently.
11. As a home cook, I want nutrition shown per serving, so that it matches how I eat the dish.
12. As a home cook, I want a recipe whose every line is uncounted to show no worked-out total, so that I am not shown a misleading zero.
13. As a home cook, I want a small credit line naming the datasets behind a total, so that I can trust where the numbers came from.
14. As a home cook, I want an Ingredient's panel to show its numbers per 100 g and the dataset food they came from ("Onion, raw · CIQUAL 2025"), so that I can check them.
15. As a home cook, I want an Ingredient's panel to say when its numbers are borrowed ("from onion"), so that I understand why a red onion reads like an onion.
16. As a home cook, I want an Ingredient's panel to show its piece weight and density with their sources, so that I can see how pieces and cups become grams.
17. As a household member, I want to correct an Ingredient's numbers by picking a different dataset food ("Milk, semi-skimmed, UHT"), so that the numbers match what we actually buy.
18. As a household member, I want to correct an Ingredient's numbers by typing them from a pack label per 100 g, so that foods no dataset knows still count correctly.
19. As a household member, I want to correct an Ingredient's piece weight and density the same way, so that our "medium onion" or our flour counts right.
20. As a household member, I want to correct any Ingredient, including seeded ones like milk, without asking an administrator, so that fixing our numbers is never blocked.
21. As a household member, I want my correction to apply for everyone in my household, so that we all see the same totals.
22. As a household member, I want my correction to stay invisible to other households, so that our habits don't change their numbers.
23. As a household member, I want the most recent correction to win when two of us correct the same Ingredient, so that there is always one value.
24. As a household member, I want to remove a correction and return to the dataset's numbers, so that a mistake is easy to undo.
25. As a household member, I want other members to see my correction without reloading, so that the household's view stays consistent.
26. As a household member, I want a child food that borrows from a corrected parent to borrow the correction, so that correcting "onion" fixes "red onion" too.
27. As a home cook, I want the names under "Not counted" to open that Ingredient's panel, so that I can fix what's missing in one step.
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
44. As an administrator on an instance with AI, I want the language model to estimate only the lines Ingredient Nutrition can't count, so that AI cost and invention are kept to the gaps.
45. As an administrator, I want the Ingredients page to credit CIQUAL, CALNUT, USDA and CoFID beside Open Food Facts, so that the instance meets the datasets' attribution terms.
46. As a signed-in user downloading the catalogue export, I want each Ingredient's source codes and numbers included, so that the ODbL share-alike is honoured.
47. As a household member, I want my household's corrections never included in the catalogue export, so that our data stays ours.
48. As a Norish maintainer, I want the source table rebuilt monthly by a workflow that opens a pull request, so that new dataset editions and name matches arrive without anyone remembering.
49. As a Norish maintainer, I want new name matches to show up as a diff in that pull request, so that a person reads them before they reach instances.
50. As a Norish maintainer, I want a failed monthly run to just fail and retry next month, so that a dataset host being down never blocks a release.
51. As a Norish maintainer, I want a fix-list entry pointing at a dataset food that no longer exists to fail the build script, so that a broken fix never ships.

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

  Piece weight and density follow the same order independently.
- It is the only place that knows this order. The panel read, the recipe read and the AI estimator all go through it.

**Recipe arithmetic (a new pure function in the shared lib, beside the line cost)**
- Input: a recipe's lines (amount, unit id, Ingredient), its servings, and the resolved nutrition per Ingredient.
- Output: per-serving numbers, the uncounted lines, an estimated flag, and the set of sources used.
- How a line reaches grams:
  - weight units convert directly;
  - piece, clove, slice and no unit go through the piece weight;
  - ml, tsp (5), tbsp (15) and cup (240) go through the density, using the existing unit table's volume definitions;
  - pinch, dash and to_taste count as zero and aren't listed;
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
- The nutrition estimator is given the counted lines' numbers as an appended prompt section (ADR-0016) and estimates only the uncounted lines.
- A recipe whose every line counts gets no estimate run.
- Whether the stored AI estimate holds the whole total or only the gap's share is decided with the maintainer before ticket 12 starts.

**Credit and export**
- The Ingredients page credits CIQUAL 2025 (ANSES), CALNUT, USDA FoodData Central and CoFID beside Open Food Facts.
- The catalogue JSON export gains each Ingredient's source codes and resolved dataset numbers, without corrections.

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

## Out of Scope

- Food Groups, or any marking of group nodes like vegetable or meat beyond their having no numbers.
- Sending fixes upstream to Open Food Facts.
- Product (brand) nutrition, Open Food Facts product exports, and per-category averages.
- NEVO, the Canadian Nutrient File, Frida and other datasets.
- Fuzzy or head-noun name matching on instances or in the build script.
- An instance-wide, administrator-editable correction layer, or editing the fix list on an instance.
- Assuming a density for foods without one.
- Nutrients beyond calories, fat, carbohydrates and protein.
- The mobile app, which is parked.
- Measuring on a real instance before building. The research's usage-weighted figures are taken as sufficient.

## Further Notes

- Coverage expected from the research: about 78% of taxonomy entries get numbers and 95% of recipe mentions are covered. With the fix list, about 98% of recipe mentions get plausible numbers.
- CIQUAL's terms require the source and edition date and forbid altering the data. A household's correction is shown as the household's own, never as CIQUAL's.
- Re-check pass and catalogue ticket 19 (seed and backfill mint through the resolver): the pass should resolve through the resolver, not add another copy of its rules.
