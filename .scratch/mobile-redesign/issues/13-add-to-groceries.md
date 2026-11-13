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

### Review log (2026-11-13)

Implementation `d67777430..3d6267c8a`, fixes `957769142..7946dbae0`. Standards on Sonnet low and Spec on Opus medium, twice (the ticket, then its fix range); the implementer and two fixers checked on the iPhone 18 Pro in light and dark.

Fixed, Add to groceries:
- A double tap added every line twice; the shared hook adds once per opened sheet (web's panel too). `957769142`
- Add stayed enabled before a linked recipe's lines were known, so its lines were left off; "lines ready" waits for linked recipes, in the hook the sheet, add at once and web's panel all read. `59e8f5a7f`
- The shell keeps only the Pantry subscription; groceries and the catalogue subscribe while the sheet is open, as on web. `a0c453e6f`
- The title, stepper and a disabled Add button paint at once with skeleton rows built from the real row shells; round ticks (the checkbox's selected radius is an animated style). `ecd6286df`, `b4ad93938`
- One `useGroceryLines` for both apps, returning a line's controls ready to pass. `5632ab99c`, `39b63b90a`

Fixed, every sheet (maintainer, 2026-11-13: sheets resize, open at 60-65%, and are built from one component):
- `components/sheet-options.ts`: `SHEET_OPTIONS` (form sheet, grabber, 62% and full, opens at 62%, expands when scrolled to the edge) and `FIT_SHEET_OPTIONS` (as tall as the content). `components/sheet.tsx`: `Sheet` with a title, subtitle, close and one actions slot, and three bodies (`SheetScrollView`, `SheetList`, `SheetBody`). Filters, Plan a recipe, the plan calendar, Add to groceries and the cookbook placeholders are built on it; a screen holds content only. `e3e17f24b`..`5e982f3ad`, `603957a5a`, `7946dbae0`
- The mechanism: react-native-screens leaves `bottom` off a sheet's content, so the content did not follow the sheet's height; with `bottom: 0` plain flexbox pins the header and actions. No number is tied to a screen's content.
- Pinned actions stay above the keyboard: UIKit lifts a fit sheet and expands a 62% sheet; at full height the sheet pads its bottom by the covered part. `9460981c4`
- Measured: the close button 27.0 pt below the sheet's top and the actions ending 20.0 pt above its bottom, identical on all four sheets.

Fixed, tooling: `UPLOADS_DIR` and `YT_DLP_BIN_DIR` pass through Turbo, so root `pnpm dev` honours them. `28794ed15`

Checked, no change needed: "we keep this" moves a line to the pantry unticked, as web's own rule says; adds go through the shared mutation, queue in the Outbox and keep the recipe attribution; web is unchanged by the moves (the moved test keeps its 24 tests and 69 assertions); the Turbo change does not touch task cache keys.

Rejected: a painted fade above the pinned actions (nothing on a sheet paints a strip, and iOS offers no scroll-edge effect for an RN view there).

Left as they are, with their reason:
- The plan calendar opens on today, partway down its list; iOS expands a sheet only from the top edge of its list, so there the grabber expands it.
- The servings row scrolls with the lines.
- The keyboard padding takes the full sheet's top to be the window's safe-area top (62 pt on the iPhone 18 Pro); not checked on another device.

Unexplained: `pnpm test:run` exited 1 once during the implementation, with the log lost. It has not failed in 48 runs since (uncached full runs and per-package repeats).

Not seen on a device: the skeleton first frame (the pantry was cached even after a cold start), offline.

Final state `7946dbae0`: all 11 gates exit 0 with the tests uncached, mobile lint has no warnings.
