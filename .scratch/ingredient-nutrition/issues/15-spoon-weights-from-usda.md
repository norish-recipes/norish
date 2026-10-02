# 15: Spoon weights from USDA

**What to build:** A third list of Norish's own in the source table: density fixes. Each points an OFF id at the USDA food whose measured spoon or cup weight it takes, for its density alone, while its numbers keep their own source. CIQUAL weighs no spoons. So today an Ingredient whose numbers come from CIQUAL, and whose taxonomy entry has no USDA code, has no density of its own: cumin, butter, breadcrumbs, soy sauce and vinegar among them.

The same list also gives a few hand-picked groups whose foods share a form a density their members borrow. The never-lend list now ends only the numbers' walk, so every sauce borrows `en:sauce`'s density.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] **The list and its check.** `tooling/nutrition/src/lists.ts` gains a density fix list (OFF id → `usda:` food key). The build fails, writing nothing, on an entry whose id the taxonomy lacks or whose food is not a USDA food with a density. The source table carries the list, and an instance applies it as a nutrition rule.
- [ ] **Lookup order.** For the density, a density fix comes right after the household's correction and before the fix list; the order for numbers and piece weight is unchanged. Cumin's panel reads its numbers from CIQUAL's cumin and its spoon weight from "Spices, cumin seed · USDA, chosen by Norish".
- [ ] **First entries**, each reviewed in the pull request:
  - cumin, butter, margarine, baking powder, dry yeast, cocoa powder, breadcrumbs;
  - soy sauce, mustard, mayonnaise, tomato paste, Worcestershire sauce, pesto;
  - vinegar, white wine, grated parmesan, rice.

  Fish sauce has no numbers either, so it goes on the fix list instead.
- [ ] **Group densities** sit on `en:spice`, `en:sauce`, the syrup entries (`en:syrup`, `en:sugar-syrup`, `en:glucose-syrup`, `en:invert-sugar-syrup`) and `en:vinegar`. Each points at a representative USDA food chosen in review. Garam masala then borrows the spice density and golden syrup a syrup's. Dairy, cheese, herbs, fruit, vegetables and meat get no group density.
- [ ] **Never-lend ends only the numbers' walk.** A sauce with no density of its own borrows `en:sauce`'s, and desiccated coconut borrows coconut's 0.33, while their numbers still stop there.
- [ ] **Whipped portions.** The density picker in `tooling/nutrition/src/portions.ts` skips them, so heavy and light whipping cream read their fluid cup (about 1.0 g/ml, not 0.5).
- [ ] **Vegetable broth** joins the fix list, like chicken and beef broth.
- [ ] **Agave syrup's 0.92** is checked against USDA's portions and fixed if the picker chose the wrong one.
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
