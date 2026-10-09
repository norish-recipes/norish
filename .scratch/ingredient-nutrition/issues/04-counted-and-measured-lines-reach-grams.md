# 04: Counted and measured lines reach grams

**What to build:** Counted lines (no unit, piece, clove, slice) reach grams through the Ingredient's piece weight. Spoon, cup and ml lines reach grams through its density. Piece weights come from the taxonomy's `average_weight_per_unit`, then USDA's portion table: a "medium" or "whole" portion, else the first counted one, else one whose modifier matches the unit. Densities come from USDA's cup, tablespoon and teaspoon portions, then the taxonomy's `density_g_per_ml`. Both are kept in the source table and borrowed along the tree like the numbers, with the same never-lend list. Water density is never assumed.

**Blocked by:** 02

**Status:** done, pending gates and review

- [x] "2 onions" counts at two piece weights of onion; "3 cloves garlic" at three of garlic's clove portion.
- [x] "1 cup milk" and "2 tbsp olive oil" count through their densities.
- [x] "1 cup flour" without a density is named under "Not counted", never counted at 240 g.
- [x] "1 red onion" with no piece weight of its own borrows onion's and marks the total estimated.
- [x] The panel shows the piece weight and density with their sources.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented. A USDA food's piece weight is its "medium" or "whole" portion, else its first portion counted in pieces. That second rule also covers "one whose modifier matches the unit" (garlic's first counted portion is its clove). Density comes from a plain cup, then tablespoon, then teaspoon, then fl oz or ml portion, preferring the plain measure to a cut one ("cup" before "cup, chopped").
- Following "hide the algorithm", the panel shows and corrects a density as what a cup weighs, never in grams per millilitre.
