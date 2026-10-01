# 03: Borrowing from a parent

**What to build:** An Ingredient without numbers of its own borrows from its nearest Parent Ingredient that has some, at any distance, along Norish's tree (so a parent a person chose lends too). It skips the never-lend list, which is kept in the source table: sauce, alcohol, coconut, soy protein, ham, cod, chicken meat, beef meat, cream, wine and fruit. A child of a never-lend parent has no numbers. The panel says where borrowed numbers come from ("from onion"), and a recipe total that borrowed anywhere says it is estimated.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] "Red onion" with no code reads onion's numbers, marked as borrowed from onion.
- [ ] Borrowing passes over an ancestor without numbers to the next one up.
- [ ] Brandy under alcohol has no numbers, and a brandy line is named under "Not counted", not counted at 660 kcal.
- [ ] Re-parenting an Ingredient changes what it borrows.
- [ ] A recipe total with any borrowed line is marked estimated; one without is not.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
