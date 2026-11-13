# 13: Add to groceries

**What to build:** The Add to groceries sheet from a card and after planning. See `.scratch/mobile-redesign/spec.md` Part 2 ("Planning and groceries") and the HomeMiniGroceries board.

**Blocked by:** 12

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: all logic of `mini-groceries.tsx` (`useLinesToBuy`, the to-buy / pantry split, pre-ticks, ticks following a line across sections, `toggleSection`, `keepLine`, `AddAtOnce`, the line parsing helpers) and `use-groceries-pantry-and-catalogue-subscriptions.ts`.
- [ ] Servings stepper, To buy and In your pantry with select/deselect all, "we keep this", "Add N items".
- [ ] Add at once works from ticket 12's preference without the sheet, and opens it when the Pantry can't be read, as on web.
- [ ] The sheet paints cached lines or a skeleton in its first frame, and is glass with no solid footer.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
