# 06: Name matching in the build script

**What to build:** The build script matches taxonomy entries that have no numbers from a code against CIQUAL, USDA and CoFID food names, and commits the matches in the source table keyed by OFF id, at step 7 of the lookup order. Names are folded (lowercase, accents and punctuation removed), then matched exactly, then normalised. Normalising drops brackets, filler words and raw-state words ("raw", "fresh", "average", "plain"), singularises, and compares sets of words. Words that change the food are kept (whole, dried, cooked, powder, smoked, salted). When several dataset foods share a key, the match is taken only if their calories agree within 10%. It runs only in the build script, never on an instance.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] "Red onion" matches "Onions, red, raw"; "whole rice flour" does not match "rice flour".
- [ ] An ambiguous key whose candidates disagree by more than 10% gives no match.
- [ ] Wine reads about 77 kcal per 100 g, not pure alcohol.
- [ ] The panel shows a matched Ingredient's source with "matched by name".
- [ ] CoFID joins the Ingredients page credit.
- [ ] A hand-checked sample of 50 matches is recorded in the ticket's comments.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
