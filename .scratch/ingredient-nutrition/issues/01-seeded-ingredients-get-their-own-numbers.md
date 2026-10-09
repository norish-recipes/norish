# 01: Seeded Ingredients get their own numbers

**What to build:** The tracer bullet. The catalogue seed keeps each taxonomy entry's nutrition codes (CIQUAL code and proxy, USDA codes, other CIQUAL-keyed codes, `average_weight_per_unit`, `density_g_per_ml`) instead of discarding every property. A build script reduces CIQUAL 2025 (2020 for codes 2025 dropped), CALNUT and USDA SR Legacy + Foundation to a committed source-number table. An instance applies it at boot when a release carries a new version of it, recorded like the seed state. An Ingredient's panel on the Ingredients page shows its Ingredient Nutrition per 100 g and the dataset food it came from ("Onion, raw · CIQUAL 2025"). Only the Ingredient's own codes count here; borrowing, the fix list and name matches come later.

**Blocked by:** None (can start immediately)

**Status:** done, pending gates and review

- [x] The seed stores each entry's nutrition codes, piece weight and density; a re-apply of an unchanged taxonomy changes nothing.
- [x] The build script is reproducible from the public downloads and produces the committed table; "traces" counts as 0, "< x" as x/2, and a row without all four values is skipped.
- [x] Lookup order over own codes: CIQUAL code, CIQUAL proxy, CALNUT, USDA codes (energy falling back to Atwater, carbohydrate by difference falling back to summed), other CIQUAL-keyed codes. Own before inherited: `en:white-wine` reads dry white wine, not pure alcohol.
- [x] The table is applied at boot only when its version changed; a failed apply leaves the last good one.
- [x] The Ingredient panel shows the four numbers and their source, or says it has none.
- [x] The Ingredients page credits CIQUAL 2025 (ANSES), CALNUT and USDA FoodData Central beside Open Food Facts.
- [x] The catalogue JSON export carries each Ingredient's source codes and resolved numbers.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented. The build script is the `tooling/nutrition` workspace (`pnpm --filter @norish/nutrition-sources build:table [--downloads <dir>]`). It finds each dataset's newest edition on its publisher's page and writes `packages/shared-server/src/ingredients/nutrition/source-table.json`, one food per line, versioned by a content hash. A live run from the public downloads reproduced the committed table byte for byte (version `ad99c16a10a2ed74`: 14,504 foods, 148 name matches, 21 fixes).
- CIQUAL 2025 comes from ANSES's English workbook. CIQUAL 2020 and CALNUT come from the copies Open Food Facts vendors, because ANSES serves only 2025 now. A 2020 row is kept where 2025 gives no full numbers for its code, and a CALNUT row (middle bound, named by CIQUAL's English name where either edition has one) where neither does.
- On an instance: migration `0066_ingredient_nutrition` (`nutrition_foods`, `nutrition_rules`, `ingredients.nutrition_codes`, and ticket 08's corrections). The seed stores `nutritionCodes` and compares them in a fixed key order, so an unchanged file writes nothing. Boot applies the table in one transaction when its version differs from the seed state's `nutritionVersion` (`applyNutritionSourcesOnBoot`).
- The module is `shared-server/src/ingredients/nutrition/ingredient-nutrition.ts`; the panel reads it through `ingredients.nutrition`. The export gains `nutritionCodes`, `nutrition` and `nutritionSources`.
