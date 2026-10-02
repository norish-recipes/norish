# 15: Spoon weights from USDA

**What to build:** A third list of Norish's own in the source table: density fixes. Each points an OFF id at the USDA food whose measured spoon or cup weight it takes, for its density alone, while its numbers keep their own source. CIQUAL weighs no spoons. So today an Ingredient whose numbers come from CIQUAL, and whose taxonomy entry has no USDA code, has no density of its own: cumin, butter, breadcrumbs, soy sauce and vinegar among them.

The same list also gives a few hand-picked groups whose foods share a form a density their members borrow. The never-lend list now ends only the numbers' walk, so every sauce borrows `en:sauce`'s density.

**Blocked by:** None (can start immediately)

**Status:** done, pending gates and review

- [x] **The list and its check.** `tooling/nutrition/src/lists.ts` gains a density fix list (OFF id → `usda:` food key). The build fails, writing nothing, on an entry whose id the taxonomy lacks or whose food is not a USDA food with a density. The source table carries the list, and an instance applies it as a nutrition rule.
- [x] **Lookup order.** For the density, a density fix comes right after the household's correction and before the fix list; the order for numbers and piece weight is unchanged. Cumin's panel reads its numbers from CIQUAL's cumin and its spoon weight from "Spices, cumin seed · USDA, chosen by Norish".
- [x] **First entries**, each reviewed in the pull request:
  - cumin, butter, margarine, baking powder, dry yeast, cocoa powder, breadcrumbs;
  - soy sauce, mustard, mayonnaise, tomato paste, Worcestershire sauce, pesto;
  - vinegar, white wine, grated parmesan, rice.

  Fish sauce has no numbers either, so it goes on the fix list instead.
- [x] **Group densities** sit on `en:spice`, `en:sauce`, the syrup entries (`en:syrup`, `en:sugar-syrup`, `en:glucose-syrup`, `en:invert-sugar-syrup`) and `en:vinegar`. Each points at a representative USDA food chosen in review. Garam masala then borrows the spice density and golden syrup a syrup's. Dairy, cheese, herbs, fruit, vegetables and meat get no group density.
- [x] **Never-lend ends only the numbers' walk.** A sauce with no density of its own borrows `en:sauce`'s, and desiccated coconut borrows coconut's 0.33, while their numbers still stop there.
- [x] **Whipped portions.** The density picker in `tooling/nutrition/src/portions.ts` skips them, so heavy and light whipping cream read their fluid cup (about 1.0 g/ml, not 0.5).
- [x] **Vegetable broth** joins the fix list, like chicken and beef broth.
- [x] **Agave syrup's 0.92** is checked against USDA's portions and fixed if the picker chose the wrong one.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, measured on the dev database with the real modules:
  - 53 of 85 commonly spooned foods had a density; the first entries bring that to 73, and the group densities to 78.
  - In the dev recipes, 10 of the 14 spoon and volume lines left out then count, 11 with the vegetable broth fix. Still out: two ground-coriander lines under `en:coriander` and a vegetable stock minted under the generic `en:broth`.
  - The build's name normalisation would have found one of these USDA foods, because USDA names keep "Spices,", "Leavening agents," and "Salad dressing," on purpose.
  - The plain USDA matches (FDC ids), as a starting point for review:

    | Food | FDC id |
    |---|---|
    | cumin | 170923 |
    | butter | 173430 |
    | margarine | 172346 |
    | baking powder | 172803 |
    | dry yeast | 175043 |
    | cocoa | 169593 |
    | breadcrumbs | 174928 |
    | soy sauce | 174277 |
    | fish sauce | 174531 |
    | mustard | 172234 |
    | mayonnaise | 171009 |
    | tomato paste | 170459 |
    | Worcestershire sauce | 171610 |
    | pesto | 171579 |
    | vinegar | 172237 |
    | white wine | 174837 |
    | grated parmesan | 171247 |
    | rice | 169756 |
- How well one density per group stands in for a food's own, across USDA's foods:
  - **Tight:** oils 0.77–0.93, vinegars 0.99–1.06, sauces 0.86–1.38, syrups 0.92–1.42.
  - **Rough:** ground spices 0.14–0.74, median 0.43.
  - **Too different for one figure:** dried leafy herbs (median 0.12) and granular sugars (powdered 0.50, granulated 0.83). Dried herbs sit under `en:herb`, not `en:spice`, so the spice density never reaches them.
- Seen while measuring, and not fixed here:
  - dried parsley borrows fresh parsley's 0.25 (a density fix to "Spices, parsley, dried" would fix that);
  - curry leaves borrow curry powder's density;
  - a minted "sambal oelek" under chili pepper borrows sun-dried chiles' 0.15.
- 2026-10-02, implemented. The table carries `densityFixes` (written between the fix list and the never-lend list), an instance applies them as `density` rules, and the module takes one right after the household's correction, as a `fix` source, so the panel says "Spices, cumin seed · USDA FoodData Central, chosen by Norish". The build refuses a density fix whose id the taxonomy lacks, or whose food is not a USDA food with a density.
  - Taxonomy ids where the ticket's names had none:
    - dry yeast is `en:yeast` (where "gist" and "yeast" land, its numbers CIQUAL's yeast flakes) and `en:dry-baker's-yeast`, both active dry yeast: a spoon of yeast is dry;
    - cocoa is `en:cocoa` ("cacao") and `en:cocoa-powder`;
    - grated parmesan is `en:parmigiano-reggiano`, with USDA's grated parmesan;
    - tomato paste is `en:tomato-concentrate`, whose names include "tomato paste".
  - Group representatives, for review:
    - `en:spice` takes curry powder (0.42; ground spices' median is 0.43);
    - `en:sauce` takes a bottled tomato chili sauce (1.14; the sauces' median is 1.12);
    - `en:syrup` and `en:sugar-syrup` take the table syrup of corn, refiner's syrup and sugar (1.32);
    - `en:glucose-syrup` and `en:invert-sugar-syrup` (golden syrup's parent) take light corn syrup (1.42);
    - `en:vinegar` takes distilled vinegar (0.99), its own fix as well.
  - Agave: the picker took USDA's ¼ cup at 55 g (0.92), which disagrees with USDA's own teaspoon of agave (6.9 g, 1.38) and with labels (21 g a tablespoon). No picker rule picks the teaspoon without moving dozens of other foods ("a whole measure first" would also change onion flakes and rice mixes), so agave takes a density fix to honey (1.41, the same 21 g tablespoon).
  - Whipped portions: a portion whose label says "whipped" outside brackets is skipped, so "cup, fluid (yields 2 cups whipped)" counts. Only the two whipping creams change in the whole table (0.5 to about 0.99); the taxonomy reaches them through `en:cream-with-36%-milk-fat`.
  - Never-lend lending its density reaches 51 Ingredients on the dev database: 41 sauces and 10 kinds of coconut. Coconut's grated meat (0.33) would have weighed coconut fat (an oil) at a third, so `en:coconut-fat` takes a density fix to USDA's coconut oil (0.91), which its butter and hydrogenated fat borrow. Coconut milk and water have densities of their own.
  - Fish sauce and vegetable broth joined the fix list (USDA's ready-to-serve ones).
  - Measured on the dev database with the real modules, the new table applied as a boot would apply it:
    - 30 of the 33 volume lines count, against 19 before;
    - 35 of 37 commonly spooned foods have a density;
    - still out: the two ground-coriander lines under `en:coriander` and the vegetable stock minted under `en:broth`, as predicted.
  - Seen and left alone:
    - `en:heavy-cream` and `en:whipping-cream` have no density (their numbers come by name from foods with no portions), so their cup lines are left out, never halved; a density fix to USDA's heavy whipping cream would count them;
    - ricotta reads 1.35 from a "0.2 cup" portion where its whole cup says 1.08, another fractional portion like agave's.
