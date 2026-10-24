# 22: A parent inside a name needs four letters

**What to build:** A parent from the words that is found anywhere but at the end of a name needs a spelling of at least four letters. Short seeded spellings are real words somewhere ("te" is tea in Spanish and Italian), but inside another name they are mostly a different word (Mike, 2026-10-20: agreed over a hand-picked list of bad spellings):

- "olie om te bakken" is not filed under tea ("te");
- "raw king prawns" is not filed under apples ("raw");
- "mil liquid sweetener" is not filed under honey ("mil");
- "zo n bakje" is not filed under bone ("zo").

A parent whose spelling ends the name keeps any length: "olive oil" stays under oil.

- **`RUNG_VERSION` goes up**, so the startup recheck files old mints again under the rule.

**Blocked by:** None

**Status:** done

- [x] The four names above get no parent from their words; "olive oil" is still under oil.
- [x] All `CONTRIBUTING.md` gates pass.

## Comments

Measured on ticket 16's hand-marked set: 22 unsure parents come from a spelling under four letters, 12 wrong and 10 right. The rule drops all 22. The right ones lost are "kip filet" (chicken), "romaine sla krop" (lettuce), "egg yolk" (egg), "sap van" (juice), "smoked cod loins" (cod), "bay leaf" and four "oil for …" lines. Those four become sure under ticket 20 anyway. The others lose a guess, not a flag: a mint without a parent is flagged too, and AI's pass decides. A three-letter minimum would drop only the six "te" and "zo" parents, all wrong, and none right.

2026-10-20, implemented:

- `parentFromWords` reads a window that does not end the name only when its spelling has four letters or more (spaces not counted). "olie om te bakken" is now filed under oil ("olie", four letters) instead of tea. `RUNG_VERSION` is 8.
- The recheck used to skip every mint with a parent, so the version bump alone moved nothing. It now reads again a mint whose parent is still its words' open guess, and moves the guess or takes it off (`fileUndecidedMint`'s `expectedParentId`). A parent AI gave, or took away, is left to AI.
