# 19: Nutrition on an upgraded instance

**What to build:** On Mike's production copy, every one of the 421 recipes stores Nutrition Information of its own, most of it the old language-model estimate. So no recipe shows a worked-out total. Forcing totals on exposed three faults.

Borrowed piece weights are wrong for parts and small kinds:

- egg yolk weighed 60 g (an egg);
- lemon zest weighed 60 g (a lemon);
- a cherry tomato weighed 150 g (a tomato);
- pak choi weighed 1,248 g (a cabbage head);
- a gherkin weighed 300 g (a cucumber);
- spring onion's taxonomy weight is 100 g.

174 lines carry their weight in brackets ("1 (15 ounce) can coconut milk", "1 medium (200 g) onion"), and 37 of them were still left out for want of a weight.

"large", "medium" and "small" are stored as units on 103 lines and read as a measure with no size.

**Blocked by:** None (can start immediately)

**Status:** done, pending review

- [x] Piece fixes in `tooling/nutrition/src/lists.ts`, the way density fixes work: the dataset food whose piece weight an entry takes, or none, which also stops the entry borrowing one.
  - Cherry tomato, egg yolk, egg white, spring onion, gherkin and pak choi point at their USDA food.
  - Lemon and orange zest have no piece.
- [x] A line that can't be weighed by its amount and unit takes the weight written in its brackets. That weight is per piece for a count or a container, and the total for a measure.
- [x] A size word stored as the unit ("large", "medium", "small") counts one piece.
- [x] A line with no unit whose text starts with a unit of mass or volume ("150" of "GR CHERRYTOMATEN") is read with that unit; nothing stored changes.
- [x] "eetl" and "theel" are a tablespoon and a teaspoon in the default units.
- [x] Measured against the production copy, before and after.
- [x] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, Mike's call: piece weights get a fix list, rather than never borrowing, which would cost the varieties their correct weight (red onion, Roma tomato).
- 2026-10-02, implemented.
  - `PIECE_FIXES` reaches the table as `pieceFixes` and the rules as kind `piece`, `food` null for none. The lookup takes it right after a household's correction, in place of the taxonomy and the codes. An entry with a piece fix never borrows a piece weight, so a fix of none leaves it with none.
  - The build fails where a piece fix names a food without a piece weight, or an entry the taxonomy lacks.
  - The table rebuilt offline from the cached downloads (version `35fa7cd90b73f782`) differs from `f99017737582655c` only in the new `pieceFixes` block.
  - `bracketedGrams` (`@norish/shared/lib/recipe-nutrition`) reads the first bracket that opens with a number and a unit of mass. "(400 ml)" and "(15 fl oz)" are no weights.
  - In `weigh`, the brackets stand in only where the line has nothing else, as the ticket says: per container ("1 can (400 g)"), per piece without a piece weight ("2 (8 ounce) chicken breasts"), the whole measure without a density ("2 tbsp (30 g) oil").
  - "large", "medium" and "small" join the piece units.
- 2026-10-02, measured. Every recipe's total was worked out over a pristine copy of the production data, after a replay of the fixed upgrade:

  |                               | first run | fixed |
  | ----------------------------- | --------- | ----- |
  | lines counted                 | 43%       | 62%   |
  | recipes with 80% of lines in  | 11        | 79    |
  | recipes with half their lines | 168       | 328   |
  | recipes with no total at all  | 20        | 7     |
  | lines left out for no numbers | 1,791     | 710   |
  - 6 cherry tomatoes now weigh 60 g (were 900 g), a bosui 15 g, an augurk 35 g, and lemon zest is left out for no piece weight.
  - "1 (15 ounce) can lite coconut milk" weighs 425 g and "1 can (400 g) pizza sauce" 400 g.

- Open, reported to Mike, not done:
  - A part borrows its whole food's piece weight where it is a mint the fix list can't reach: "(8 ounce) can pineapple bits" weighs a pineapple, 905 g, and "1 large iceberg lettuce leaf" weighs the head, 755 g. Preferring the brackets would fix the first, but make "1 medium (150 g) green pepper" count 150 g of the peppercorn Open Food Facts means by green pepper.
  - "green pepper" is the spice in the taxonomy and a bell pepper in most recipes.
- 2026-10-02, Mike: clearing stored nutrition was only for testing on the production copy, never for a release. Migration 0070, its upgrade note and the ADR-0039 line are removed, and a recipe that stores numbers keeps showing them. To see worked-out totals on a test copy, null the four columns there by hand.
- 2026-10-02, Mike approved reading a unit an older import left in the text (57 unitless lines on his copy start with "GR", "TL", "TBSP", "Cup", "Oz"…). Today's parser splits "500 GR KRIELTJES" itself, so only old lines need it. `leadingUnitOf` reads the first word of a unitless line's text, mass or volume only (a count or a container there stays the food's words), and never writes it back. Today's parser still missed "2 eetl olijfolie", hence the two alternates.
  - Replayed with the plural filing of catalogue ticket 20: lines counted 61.7% → 63.5%, recipes with 80% of lines in 79 → 91, lines left out for no numbers 710 → 629.
  - "150 GR CHERRYTOMATEN" now weighs 150 g instead of 1,491 g.
