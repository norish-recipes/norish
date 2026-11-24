# Each household has its own catalogue on a shared seed

ADR-0037 made one spelling one food for the whole server, so teaching Norish something once taught every household. The same rule lets one household decide what another household's text means. Each of these changes what household B's lines and groceries resolve to:

- a spelling household A adds, even to a seeded food;
- a food A's groceries mint;
- a junk mark A makes.

A's foods, icons and AI Changes also show on B's Ingredients page and in the catalogue export.

**Each household's catalogue is the shared seed plus its own foods, spellings and junk marks.**

- A spelling is unique within a household and among the seed. Resolution reads only the household's spellings and the seed's.
- A new food lands in the household whose recipe, grocery or pantry created it.
- AI review, Catalogue Cleanup and Fill Gaps run inside one household. They never merge, move or parent across households.
- Merging needs edit rights on both foods, so it never crosses households.

The seed stays the administrator's. A spelling a household adds to a seeded food belongs to that household.

## Considered Options

- **Let the Permission Policy decide** (at Everyone, households share teaching as today). Narrowing the policy later would have to split every food two households came to share. Widening it would have to choose between two households' foods with the same spelling.
- **Hide other households' foods from lists only.** Resolution would still cross households, and that crossing is the leak.

## Consequences

- Amends ADR-0037: "one spelling, one food" holds within a household's catalogue, not across the server.
- Amends ADR-0038: the export is the seed plus the reader's household's own foods.
- Households no longer benefit from each other's teaching. The seed is what they share.
- Using another household's recipe reads its lines through your own catalogue. Adding it to groceries, pantry coverage, and your household's worked-out nutrition all resolve each line's text again.
- The separate ingredient edit policy goes: any member edits the household's own foods.
- A food added by hand is never removed by the unused sweep or by AI. Minted foods keep the 90-day rule.
- The upgrade splits each non-seed food that several households use into one copy per household. The household that minted it keeps the original.
