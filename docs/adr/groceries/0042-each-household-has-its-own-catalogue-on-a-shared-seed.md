# Each household has its own catalogue on a shared seed

If one spelling were one food across the whole server, one household could decide what another household's text means. Any of these would change what household B's lines and groceries resolve to:

- a spelling household A adds, even to a seeded food;
- a food that A's groceries mint;
- a junk mark A makes.

A's foods, icons and AI Changes would also list on B's Ingredients page and in the export.

**Each household's catalogue is the shared seed plus its own foods, spellings and junk marks.**

- A spelling is unique within a household and among the seed. Where a household's own spelling and the seed's are the same, the household's wins for that household.
- Resolution reads only the household's spellings and the seed's.
- A seed refresh never takes over or changes a household's own food.
- A mint lands in the household whose recipe, grocery or pantry triggered it.
- AI review, Catalogue Cleanup and Fill Gaps run inside one household and never merge, move or parent across households.
- Merging needs edit rights on both foods, so it never crosses households.

The seed is the administrator's. A household's spelling on a seeded food belongs to that household.

## Considered Options

- **Let the Permission Policy decide**, so that at Everyone households share their teaching. Narrowing the policy would then have to split every food two households came to share. Widening it would have to choose between two households' foods with the same spelling.
- **Hide other households' foods from lists only.** Resolution would still cross households, and that is the leak.

## Consequences

- Households share the seed and nothing else of the catalogue.
- The catalogue export (ADR-0038) is the seed plus the reader's household's own foods.
- Using another household's recipe reads its lines through your own catalogue. Adding it to groceries, pantry coverage and your household's worked-out nutrition all resolve each line's text again.
- Any member edits the household's own foods. There is no separate ingredient permission policy.
- A food added by hand is never removed by the unused sweep or by AI. Minted foods keep the 90-day rule.
- The upgrade splits each non-seed food used by several households into a copy per household. The minting household keeps the original.
