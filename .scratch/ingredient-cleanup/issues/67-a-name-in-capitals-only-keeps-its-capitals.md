# 67: A name in capitals only keeps its capitals

**What to build:** Left open by ticket 62 (2026-10-22). Since a plain name equal to the name but for case settles the name, an own food named in capitals only ("TONIJN UIT BLIK") keeps its capitals, though CONTEXT.md says a food is lower case.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

A name in capitals only is lowered: when the plain name differs from the name only in case and the name has no lower-case letters, the food takes the plain name. A name with mixed case ("Tortilla Chips") keeps its casing as ticket 62 does.

## Implemented (2026-10-23)

- `giveItsPlainName` (`ingredients/plain-names.ts`): a name with a lower-case letter (`/\p{Ll}/u`) settles on a fold-equal plain name as ticket 62 does; a name without one settles only on a plain name equal as written, so "TONIJN UIT BLIK" with plain name "tonijn uit blik" goes on to the lookup and `renameByAI` (a sure plain-name AI Change, as any rename).
- Test: `plain-names.test.ts` "lowers a name in capitals only to its plain name". CONTEXT.md's Plain Name entry says so. No release-notes line (ticket 62's case-only rule was never released).
