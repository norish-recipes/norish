# 11: Kept distinct, and re-checking old flagged Ingredients

**What to build:** Mark distinct is recorded on the Ingredient, so Norish never merges it later; today it only clears the flag. A pass at startup looks again at every Flagged Ingredient with no OFF id, the mints an instance's history left behind. It merges one into the Ingredient that rungs 1 and 2 now resolve it to, and otherwise applies ticket 10's parent. It skips any Ingredient a person kept distinct, renamed or parented. It runs again whenever the rung version recorded in the seed state changes. Lines on legacy recipes reach seeded Ingredients this way without AI.

**Blocked by:** 09, 10

**Status:** ready-for-agent

- [ ] Marking an Ingredient distinct is stored; existing Ingredients start unmarked.
- [ ] After the pass, a legacy "salt to taste" Ingredient is merged into salt and its lines point at salt's Ingredient through their unchanged aliases.
- [ ] A legacy "verse peterselie" is parented under peterselie and stays flagged.
- [ ] Kept-distinct, person-renamed and person-parented Ingredients are untouched.
- [ ] The pass runs once per rung version; a second boot does nothing.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- Related to `.scratch/ingredient-catalogue/issues/19-seed-and-backfill-mint-through-the-resolver.md`: the pass should resolve through the resolver rather than adding a third copy of its rules.
