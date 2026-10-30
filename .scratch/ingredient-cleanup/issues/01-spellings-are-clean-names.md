# 01: Spellings are clean names

**What to build:** A translation is always a clean name. Before the resolver reads a text, it strips stray punctuation, unmatched brackets, doubled brackets, a leading "+ / - :", prices like "($0.02)" and notes like "(Note 1)". "gyoza vellen ((ontdooid))" and "12 gyoza vellen" both point at the translation "gyoza vellen". A new food gets only its clean spelling: plain, else bare. A join with a known food adds the same. Neither ever adds the text as written. Today's bracket stripping leaves the ")" of "((ontdooid))"; that bug is fixed in the shared spelling keys, so the clients match the same way. A colon line with no amount names no food when read ("Voor de salade:"). A typed grocery that names no food (")") mints nothing and points at no food. The seed strips stray marks ("3wu)" becomes "3wu", "|चौलाई}}" becomes "चौलाई") and keeps balanced brackets, which tell foods apart ("paprika (vrucht)" stays bell pepper). A translation a person types in the Ingredient panel is stored clean, as a recipe text is read. A recipe save keeps the foods of every line whose text, amount and unit didn't change, and resolves only changed or new lines. Words only: no AI is involved.

See `CONTEXT.md` (Ingredient Alias, Junk Line) and ADR-0037's second 2026-10-17 amendment.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Resolving "gyoza vellen ((ontdooid))", "gyoza vellen (ontdooid)" and "12 gyoza vellen" gives one alias, whose text is "gyoza vellen"; no alias with brackets or a number is created.
- [x] Spelling keys strip nested and doubled brackets whole, and no key ends in a stray ")".
- [x] Prices, "(Note n)" notes and a leading "+", "/", "-" or ":" are stripped before reading, and the line's own text is unchanged.
- [x] A colon line with no amount stores no food; a colon line with an amount is read as before.
- [x] A grocery typed as ")" or "—" is saved with no food and mints no Ingredient.
- [x] Seed entries lose stray marks and keep balanced brackets; "paprika (vrucht)" still resolves to bell pepper exactly.
- [x] A translation added in the panel, or by a rename, is stored clean: "Gyoza vellen ((diepvries))" is "Gyoza vellen".
- [x] Saving a recipe after editing one line resolves only that line; the other lines keep their foods without asking AI (asserted with AI mocked at the runtime).
- [x] Resolver and spelling-key tests cover the cases above against a real database; `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build` pass.

## Comments

2026-10-17, implemented:

- The nested-bracket strip ("((ontdooid))") had already landed on 2026-10-15 (5c17fba51); production's 0.25 predates it. This adds what was still missing: `cleanSpelling` in `@norish/shared/lib/spelling-keys` (stray closers, edge marks, doubled brackets, prices, notes, cleaned to a fixed point) under every spelling key, and `withoutStrayMarks` for the seed.
- A mint or an AI join adds one alias, the clean spelling (plain, else bare, else the words of a text that is all brackets). `resolveIngredients` answers null for a text that names no food, so a typed ")" grocery mints nothing, and a pantry text like "200g" is refused with a 400 instead of a 500.
- A save keeps a stored line's food while its `lineFoodText` is unchanged, not its exact text, amount and unit: the web editor re-parses each row as "amount unit name", so "GR CHERRYTOMATEN" (150, no unit) comes back as "CHERRYTOMATEN" with unit "GR", and the literal rule would resolve it again.
- `RUNG_VERSION` is 7, per its own rule, so the startup recheck reads old undecided mints with the cleaning once.
- A spelling typed in the panel, or added by a rename, is stored clean, so a recipe text can match it (Mike: "don't save it that way... just strip it"). The panel stages the clean text, so its chip shows what is stored. The Ingredient's own name stays as typed.
- Release notes and docs are left to ticket 09.

