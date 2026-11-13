# 13: Add to groceries

**What to build:** The Add to groceries sheet from a card and after planning. See `.scratch/mobile-redesign/spec.md` Part 2 ("Planning and groceries") and the HomeMiniGroceries board.

**Blocked by:** 12

**Status:** done

- [x] Moved first, in separate commits, web switched over with its unit tests: all logic of `mini-groceries.tsx` (`useLinesToBuy`, the to-buy / pantry split, pre-ticks, ticks following a line across sections, `toggleSection`, `keepLine`, `AddAtOnce`, the line parsing helpers) and `use-groceries-pantry-and-catalogue-subscriptions.ts`.
- [x] Servings stepper, To buy and In your pantry with select/deselect all, "we keep this", "Add N items".
- [x] Add at once works from ticket 12's preference without the sheet, and opens it when the Pantry can't be read, as on web.
- [x] The sheet paints cached lines or a skeleton in its first frame, and is glass with no solid footer.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Moved: the subscriptions hook, `useLineSelection`, `useAddAtOnce`, `useLinesToBuy` (pantry split, `keepLine`, `addLines`) to `groceries/`; `useRecipeFoodsToBuy` and `useUnitFormatter(locale)` to `recipes/`; the pure line helpers to `@norish/shared/lib/grocery-lines`. Domains may not import each other, so the apps compose the recipe and groceries hooks. Web switched in separate commits with no behaviour change; its test keeps all 24 assertions, mocking the hooks' leaf modules.
- Add at once: `AddAtOnceHost` above the Recipes stack adds without any sheet (plan sheet closes, toast shows) and pushes the sheet when the Pantry can't be read. The sheet reads the recipe itself and starts at `plannedServings(recipe)`, so card and after-planning share one default.
- Deviations: no inline line editing (the board draws none; the edit helpers are moved but unused on mobile); "we keep this" gives the line its new section's default, unticked, as web does; new key `groceries.panel.addCount` for "Add N items".
- Device (light and dark, before the last recomposition of the hooks, which unit tests cover): stepper, select/deselect all, keep, add (checked on web, then cleared), open and add-at-once and nothing after planning ran. Offline and the first-frame skeleton were not seen on the device.
- Sheet height follows the maintainer's rule, not the board: `SHEET_DETENTS = [0.62, 1]` (`apps/mobile/src/components/sheet-detents.ts`), `sheetInitialDetentIndex: 0`, grabber and `sheetExpandsWhenScrolledToEdge: true`; the header and footer pin through a first child as tall as both, so the list ends at the footer.
