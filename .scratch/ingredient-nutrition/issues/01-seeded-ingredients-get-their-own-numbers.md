# 01: Seeded Ingredients get their own numbers

**What to build:** The tracer bullet. The catalogue seed keeps each taxonomy entry's nutrition codes (CIQUAL code and proxy, USDA codes, other CIQUAL-keyed codes, `average_weight_per_unit`, `density_g_per_ml`) instead of discarding every property. A build script reduces CIQUAL 2025 (2020 for codes 2025 dropped), CALNUT and USDA SR Legacy + Foundation to a committed source-number table. An instance applies it at boot when a release carries a new version of it, recorded like the seed state. An Ingredient's panel on the Ingredients page shows its Ingredient Nutrition per 100 g and the dataset food it came from ("Onion, raw · CIQUAL 2025"). Only the Ingredient's own codes count here; borrowing, the fix list and name matches come later.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The seed stores each entry's nutrition codes, piece weight and density; a re-apply of an unchanged taxonomy changes nothing.
- [ ] The build script is reproducible from the public downloads and produces the committed table; "traces" counts as 0, "< x" as x/2, and a row without all four values is skipped.
- [ ] Lookup order over own codes: CIQUAL code, CIQUAL proxy, CALNUT, USDA codes (energy falling back to Atwater, carbohydrate by difference falling back to summed), other CIQUAL-keyed codes. Own before inherited: `en:white-wine` reads dry white wine, not pure alcohol.
- [ ] The table is applied at boot only when its version changed; a failed apply leaves the last good one.
- [ ] The Ingredient panel shows the four numbers and their source, or says it has none.
- [ ] The Ingredients page credits CIQUAL 2025 (ANSES), CALNUT and USDA FoodData Central beside Open Food Facts.
- [ ] The catalogue JSON export carries each Ingredient's source codes and resolved numbers.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
