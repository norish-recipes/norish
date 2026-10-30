# 84: Slashes, plusses and comma lists name one food

**What to build:** Found by the clean AI-off re-import of Mike's library (2026-10-27, after tickets 80-83). Nine "Salt & pepper" lines pointed at one food "Salt/pepper": "/" was no joining word, so "Salt/pepper" was minted whole, and "Salt & pepper" folds to the same spelling, which matched before the split ran. "pinch of salt and pepper" was minted whole as "salt and pepper" because the split read the raw text, where "of" (Dutch "or") and "and" are mixed, and two later lines matched it. Comma lists named only their first food: "peper, zout" was pepper, and "peper, zout, oregano, rozemarijn, …" too.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-27)

"& and / should be treated like AND/OR". "split at comma, and keep only foods recognised I think. Much more than that we can't do."

## Implemented (2026-10-27)

- `ingredient-words.default.json`: "+" beside "&" in every language's `together`, "/" in every `alternatives`. `joinedParts` (`gluedParts`) splits a token at "/", "&" or "+" between two letters, never a token that is a joining word itself ("and/or", "en/of"), so "1/2" and "and/or" stay whole.
- `readByWords` splits the plain name (`spelling.plain || spelling.clean`), so a leading "pinch of" is gone before the words are read.
- `laterPieces`/`knownFoodsIn`: a comma list's first piece is the line's food as rung 2 reads it, known or minted; the later pieces that are known foods join it, together, each piece also split at its "and" words; other pieces are dropped. Only a known spelling of the whole text as written is no list. Mike, 2026-10-27: a first piece no food is known for must not be lost ("kippendijfilet, zout, peper").
- `CLEANUP_VERSION` 7: the first-start cleanup splits own foods minted whole ("Salt/pepper", "salt + black pepper") and their lines follow.
- Tests: `spelling-keys.test.ts` (slash, plus, glued marks, "and/or", "1/2"), `resolver.test.ts` (plain-name split, slash, plus, comma lists, "onions, diced"), `first-start-cleanup.test.ts` (old whole foods split).
- Docs: CONTEXT.md (Alias), ADR-0037 amendment, release notes (a fixes line, the Ingredient words upgrade note), admin settings, Ingredients page, pt-BR docs.
- Existing lines whose food came from the first comma piece ("peper, zout" on pepper) are not read again: a line keeps its food until its text changes or its spelling goes. A re-import, or editing the line, reads it anew.
