# 04: Counted and measured lines reach grams

**What to build:** Counted lines (no unit, piece, clove, slice) reach grams through the Ingredient's piece weight. Spoon, cup and ml lines reach grams through its density. Piece weights come from the taxonomy's `average_weight_per_unit`, then USDA's portion table: a "medium" or "whole" portion, else the first counted one, else one whose modifier matches the unit. Densities come from USDA's cup, tablespoon and teaspoon portions, then the taxonomy's `density_g_per_ml`. Both are kept in the source table and borrowed along the tree like the numbers, with the same never-lend list. Water density is never assumed.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] "2 onions" counts at two piece weights of onion; "3 cloves garlic" at three of garlic's clove portion.
- [ ] "1 cup milk" and "2 tbsp olive oil" count through their densities.
- [ ] "1 cup flour" without a density is named under "Not counted", never counted at 240 g.
- [ ] "1 red onion" with no piece weight of its own borrows onion's and marks the total estimated.
- [ ] The panel shows the piece weight and density with their sources.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
