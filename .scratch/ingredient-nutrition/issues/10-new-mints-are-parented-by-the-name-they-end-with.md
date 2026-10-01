# 10: New mints are parented by the name they end with

**What to build:** When the resolver mints a Flagged Ingredient, it gives it the longest seeded alias its text ends with, as whole words, as its Parent Ingredient: "ground cumin" goes under cumin, "verse peterselie" under peterselie, "egg noodles" under noodles. The parent counts as not chosen by a person, so a seed refresh may still place it, and the mint stays flagged so a person sees it. A guess from words sets a parent and never merges (ADR-0037 as amended).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] "Ground cumin" mints flagged under cumin and borrows cumin's aisle (and numbers, once 03 lands).
- [ ] Longest wins: "smoked sweet paprika" goes under "sweet paprika" when the seed has it.
- [ ] Text that ends in no seeded alias mints flagged with no parent, as before.
- [ ] A person giving it another parent clears the flag and marks the parent chosen.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
