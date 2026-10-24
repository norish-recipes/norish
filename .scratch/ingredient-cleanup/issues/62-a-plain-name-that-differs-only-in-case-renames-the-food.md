# 62: A plain name that differs only in case renames the food

**What to build:** Found by ticket 31's run after tickets 57, 58 and 60 (2026-10-22, HEAD 67eb2082a, `m60_post_on`). AI's plain name for an own food was the food's own name in lower case. `giveItsPlainName` compares it with `===`, so the two count as different, the lookup finds no other food, and `renameByAI` renames the food to the lower-case copy as a sure AI Change.

On the copy: 1 food, the run's only plain-name change.

To decide: does a plain name equal to the name but for case settle the name (as an equal one does), or keep the person's casing some other way?

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-22)

"build all 4". A plain name equal to the name but for case settles the name as it is, compared with the fold spellings are compared with.

## Implemented (2026-10-22)

- `giveItsPlainName` (`ingredients/plain-names.ts`) compares `foldName(plain) === foldName(row.name)` (`@norish/shared/lib/fold-name`), so a plain name that differs only in case, accents or punctuation settles the name with its casing kept: no rename, no lookup. The plain-name request itself is still sent, since its answer is what is compared.
- Test: `plain-names.test.ts` "settles a name the plain name differs from only in case, keeping its casing" (Tortilla Chips).
- CONTEXT.md's Plain Name entry says so. No release-notes line: the rename was never in a release.
- For Mike: a name in capitals only ("TONIJN UIT BLIK") now keeps its capitals, though CONTEXT.md says a food is lower case. Say if a name all in capitals should still be lowered.
